from django.contrib.auth.models import Group, User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase
from django.urls import reverse
from unittest.mock import patch

from io import BytesIO

from openpyxl import Workbook

from .sub_models import Project, Task, TimeSheet


class AuthPageTests(SimpleTestCase):
	def test_login_page_loads(self):
		response = self.client.get(reverse("login"))
		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "Welcome back")

	def test_register_page_loads(self):
		response = self.client.get(reverse("register"))
		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "Create account")

	@patch("erp_app.sub_views.login_page_view.authenticate", return_value=None)
	def test_invalid_login_shows_error(self, _mock_authenticate):
		response = self.client.post(
			reverse("login"),
			{"username": "invalid-user", "password": "invalid-pass"},
		)
		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "Invalid username or password.")


class UserManagementApiTests(TestCase):
	def setUp(self):
		self.staff_user = User.objects.create_user(
			username="staff_user",
			email="staff@example.com",
			password="StrongPass123!",
			is_staff=True,
		)
		self.target_user = User.objects.create_user(
			username="target_user",
			email="target@example.com",
			password="StrongPass123!",
		)
		self.client.force_login(self.staff_user)

	def test_users_list_reads_from_database(self):
		response = self.client.get(reverse("api-users-list"))
		self.assertEqual(response.status_code, 200)

		payload = response.json()
		usernames = [item["username"] for item in payload["users"]]
		self.assertIn("staff_user", usernames)
		self.assertIn("target_user", usernames)

	def test_patch_user_role_persists_group_mapping(self):
		response = self.client.patch(
			reverse("api-users-detail", kwargs={"user_id": self.target_user.id}),
			data='{"role": "Manager"}',
			content_type="application/json",
		)
		self.assertEqual(response.status_code, 200)
		self.target_user.refresh_from_db()

		self.assertTrue(Group.objects.filter(name="Manager").exists())
		self.assertTrue(self.target_user.groups.filter(name="Manager").exists())

	def test_delete_user_removes_record_from_database(self):
		response = self.client.delete(
			reverse("api-users-detail", kwargs={"user_id": self.target_user.id})
		)
		self.assertEqual(response.status_code, 200)
		self.assertFalse(User.objects.filter(id=self.target_user.id).exists())


class ProjectApiTests(TestCase):
	def setUp(self):
		self.user = User.objects.create_user(
			username="project_user",
			email="project@example.com",
			password="StrongPass123!",
		)
		self.client.force_login(self.user)

	def test_create_project_defaults_updated_by_to_logged_in_user_and_saves_proposal_date(self):
		response = self.client.post(
			reverse("api-projects-create"),
			data='{"project_id": "PRJ-100", "project_name": "Beta", "proposal_date": "2026-03-10"}',
			content_type="application/json",
		)
		self.assertEqual(response.status_code, 201)

		payload = response.json()["project"]
		self.assertEqual(payload["updated_by"], "project_user")
		self.assertEqual(payload["proposal_date"], "2026-03-10")

		project = Project.objects.get(project_id="PRJ-100")
		self.assertEqual(project.updated_by, "project_user")
		self.assertEqual(str(project.proposal_date), "2026-03-10")


class TaskImportApiTests(TestCase):
	def setUp(self):
		self.user = User.objects.create_user(
			username="import_user",
			email="import@example.com",
			password="StrongPass123!",
		)
		self.project = Project.objects.create(
			project_id="PRJ-001",
			project_name="Alpha",
			updated_by="import_user",
		)
		self.client.force_login(self.user)

	def _build_excel_upload(self, rows):
		wb = Workbook()
		ws = wb.active
		ws.append([
			"S", "Project No", "Project Name", "Project ID+ Name", "Date of Proposal from customer", "Activiy",
			"Revision", "Start Date", "End Date", "No of Days", "Drawn By", "Approved By", "Approved Date", "Status\\",
			"Order Value (OMR)", "Project Owner", "Project Status", "Remarks", "Drawn By Month", "Approved By Month",
		])
		for row in rows:
			ws.append(row)

		stream = BytesIO()
		wb.save(stream)
		stream.seek(0)
		return SimpleUploadedFile(
			"task_import.xlsx",
			stream.read(),
			content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		)

	def test_import_reports_blank_rows_only_in_summary(self):
		upload = self._build_excel_upload([
			[None] * 20,
			[
				1, "PRJ-001", "Alpha", "PRJ-001_Alpha", "2026-03-01", "Design", "01",
				"2026-03-02", "2026-03-06", 5, "tester", "approver", "2026-03-07", "In progress",
				"", "owner", "", "good row", "", "",
			],
			[
				2, "BAD-001", "Missing", "BAD-001_Missing", "2026-03-01", "Drawing", "01",
				"2026-03-02", "2026-03-06", 5, "tester", "approver", "2026-03-07", "In progress",
				"", "owner", "", "bad project", "", "",
			],
		])

		response = self.client.post(reverse("api-tasks-import"), {"file": upload})
		self.assertEqual(response.status_code, 200)
		payload = response.json()

		self.assertEqual(payload["summary"]["blank_rows"], 1)
		self.assertEqual(payload["summary"]["skipped"], 1)
		self.assertEqual(payload["summary"]["created"], 1)
		self.assertEqual(payload["summary"]["failed"], 1)
		self.assertEqual(len(payload["row_reports"]), 2)
		self.project.refresh_from_db()
		self.assertEqual(str(self.project.proposal_date), "2026-03-01")

		statuses = [item["status"] for item in payload["row_reports"]]
		self.assertIn("created", statuses)
		self.assertIn("failed", statuses)
		self.assertFalse(any(item["row"] == 2 and item["status"] == "blank" for item in payload["row_reports"]))

	def test_import_reports_revision_adjustment_details(self):
		Task.objects.create(project=self.project, activity="Design", revision="01", updated_by="seed")
		upload = self._build_excel_upload([
			[
				1, "PRJ-001", "Alpha", "PRJ-001_Alpha", "2026-03-01", "Design", "01",
				"2026-03-02", "2026-03-06", 5, "tester", "approver", "2026-03-07", "In progress",
				"", "owner", "", "duplicate revision", "", "",
			],
		])

		response = self.client.post(reverse("api-tasks-import"), {"file": upload})
		self.assertEqual(response.status_code, 200)
		payload = response.json()

		self.assertEqual(payload["summary"]["created"], 1)
		self.assertEqual(payload["summary"]["revision_adjusted"], 1)
		self.assertEqual(len(payload["row_reports"]), 1)
		self.assertEqual(payload["row_reports"][0]["status"], "adjusted")
		self.assertIn("Revision changed from '01' to '02'", payload["row_reports"][0]["message"])


class TimesheetImportApiTests(TestCase):
	def setUp(self):
		self.user = User.objects.create_user(
			username="timesheet_user",
			email="timesheet@example.com",
			password="StrongPass123!",
		)
		self.project = Project.objects.create(
			project_id="PRJ-001",
			project_name="Alpha",
			updated_by="timesheet_user",
		)
		self.design_task_rev_1 = Task.objects.create(
			project=self.project,
			project_id_name="PRJ-001_Alpha",
			activity="Layout Preparation",
			revision="01",
			updated_by="timesheet_user",
		)
		self.design_task_rev_2 = Task.objects.create(
			project=self.project,
			project_id_name="PRJ-001_Alpha",
			activity="Layout Preparation",
			revision="02",
			updated_by="timesheet_user",
		)
		self.other_activity_task = Task.objects.create(
			project=self.project,
			project_id_name="PRJ-001_Alpha",
			activity="Shop Drawing",
			revision="01",
			updated_by="timesheet_user",
		)
		self.client.force_login(self.user)

	def _build_timesheet_excel_upload(self, rows):
		wb = Workbook()
		ws = wb.active
		ws.append([
			"SL No", "Name", "Project ID", "Activity", "Billing Date", "Efforts", "Remarks",
		])
		for row in rows:
			ws.append(row)

		stream = BytesIO()
		wb.save(stream)
		stream.seek(0)
		return SimpleUploadedFile(
			"timesheet_import.xlsx",
			stream.read(),
			content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		)

	def test_import_duplicate_checks_project_activity_across_task_revisions(self):
		TimeSheet.objects.create(
			task=self.design_task_rev_1,
			employee_name="timesheet_user",
			billing_date="2026-03-20",
			efforts="8",
		)

		upload = self._build_timesheet_excel_upload([
			[1, "timesheet_user", "PRJ-001_Alpha", "Layout Preparation", "2026-03-20", 8, "duplicate"],
		])

		response = self.client.post(reverse("api-timesheets-import"), {"file": upload})
		self.assertEqual(response.status_code, 200)
		payload = response.json()

		self.assertEqual(payload["summary"]["created"], 0)
		self.assertEqual(payload["summary"]["duplicates"], 1)
		self.assertEqual(TimeSheet.objects.count(), 1)
		self.assertEqual(payload["row_reports"][0]["status"], "duplicate")
		self.assertIn(
			"Employee + Project + Activity + Billing Date",
			payload["row_reports"][0]["message"],
		)

	def test_import_allows_same_project_and_date_with_different_activity(self):
		TimeSheet.objects.create(
			task=self.design_task_rev_1,
			employee_name="timesheet_user",
			billing_date="2026-03-20",
			efforts="8",
		)

		upload = self._build_timesheet_excel_upload([
			[1, "timesheet_user", "PRJ-001_Alpha", "Shop Drawing", "2026-03-20", 6, "allowed"],
		])

		response = self.client.post(reverse("api-timesheets-import"), {"file": upload})
		self.assertEqual(response.status_code, 200)
		payload = response.json()

		self.assertEqual(payload["summary"]["created"], 1)
		self.assertEqual(payload["summary"]["duplicates"], 0)
		self.assertEqual(TimeSheet.objects.count(), 2)
		self.assertTrue(
			TimeSheet.objects.filter(task=self.other_activity_task, billing_date="2026-03-20").exists()
		)



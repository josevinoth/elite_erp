from django.contrib.auth.models import Group, User
from django.test import SimpleTestCase, TestCase
from django.urls import reverse
from unittest.mock import patch


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


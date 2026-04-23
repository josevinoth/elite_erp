import json
import datetime
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST
from ..sub_models import Project, ProjectStatusOption
from ..utils import normalize_text, to_title_case
def _ensure_authenticated(request):
    if not request.user.is_authenticated:
        return JsonResponse({'message': 'Authentication required.'}, status=401)
    return None
def _read_json(request):
    try:
        return json.loads(request.body.decode('utf-8') or '{}')
    except (TypeError, ValueError):
        return {}


def _to_decimal_or_none(value):
    if value in (None, ''):
        return None
    return str(value).strip()


def _to_date(value):
    if value in (None, ''):
        return None
    if isinstance(value, datetime.date):
        return value
    try:
        return datetime.date.fromisoformat(str(value).split(' ')[0])
    except (TypeError, ValueError, AttributeError):
        return None


def _serialize(project):
    return {
        'id': project.id,
        'project_id': project.project_id,
        'description': project.description,
        'project_name': project.project_name,
        'proposal_date': str(project.proposal_date) if project.proposal_date else '',
        'updated_by': project.updated_by,
        'order_value_omr': '' if project.order_value_omr is None else str(project.order_value_omr),
        'status': project.status.name if project.status else '',
        'expected_customer_need_date': str(project.expected_customer_need_date) if project.expected_customer_need_date else '',
    }

def _project_exists_case_insensitive(project_id, project_name, exclude_id=None):
    qs = Project.objects.filter(
        project_id__iexact=project_id,
        project_name__iexact=project_name,
    )
    if exclude_id is not None:
        qs = qs.exclude(id=exclude_id)
    return qs.exists()


@require_GET
def list_project_lifecycle_meta_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    statuses = list(ProjectStatusOption.objects.order_by("name").values_list("name", flat=True))
    return JsonResponse({"statuses": statuses})


@require_POST
@csrf_protect
def create_project_lifecycle_status_option_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed

    payload = _read_json(request)
    name = to_title_case(payload.get("name", ""))
    if not name:
        return JsonResponse({"message": "Status name is required."}, status=400)

    obj, _created = ProjectStatusOption.objects.get_or_create(name=name)
    return JsonResponse({"success": True, "name": obj.name})
@require_GET
def list_projects_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed
    projects = Project.objects.order_by('-id')
    return JsonResponse({'projects': [_serialize(p) for p in projects]})
@require_POST
@csrf_protect
def create_project_api_view(request):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed
    payload = _read_json(request)
    project_id = normalize_text(payload.get('project_id', ''))
    project_name = normalize_text(payload.get('project_name', ''))
    if not project_id:
        return JsonResponse({'message': 'Project ID is required.'}, status=400)
    if _project_exists_case_insensitive(project_id, project_name):
        return JsonResponse({'message': 'Duplicate project exists (case-insensitive match).'}, status=400)
    status_name = to_title_case(payload.get('status', ''))
    status_obj = None
    if status_name:
        status_obj, _ = ProjectStatusOption.objects.get_or_create(name=status_name)

    project = Project.objects.create(
        project_id=project_id,
        description=normalize_text(payload.get('description', '')),
        project_name=project_name,
        proposal_date=_to_date(payload.get('proposal_date')),
        updated_by=normalize_text(payload.get('updated_by') or request.user.username),
        order_value_omr=_to_decimal_or_none(payload.get('order_value_omr')),
        status=status_obj,
        expected_customer_need_date=_to_date(payload.get('expected_customer_need_date')),
    )
    return JsonResponse({'success': True, 'project': _serialize(project)}, status=201)
@require_http_methods(['PATCH', 'DELETE'])
@csrf_protect
def project_detail_api_view(request, project_id):
    not_allowed = _ensure_authenticated(request)
    if not_allowed:
        return not_allowed
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return JsonResponse({'message': 'Project not found.'}, status=404)
    if request.method == 'DELETE':
        project.delete()
        return JsonResponse({'success': True, 'message': 'Project deleted.'})
    payload = _read_json(request)
    project_id = normalize_text(payload.get('project_id', project.project_id))
    project_name = normalize_text(payload.get('project_name', project.project_name))
    if not project_id:
        return JsonResponse({'message': 'Project ID is required.'}, status=400)
    if _project_exists_case_insensitive(project_id, project_name, exclude_id=project.id):
        return JsonResponse({'message': 'Duplicate project exists (case-insensitive match).'}, status=400)
    project.project_id = project_id
    project.description = normalize_text(payload.get('description', project.description))
    project.project_name = project_name
    project.proposal_date = _to_date(payload.get('proposal_date', project.proposal_date))
    project.updated_by = normalize_text(payload.get('updated_by', project.updated_by))
    if 'order_value_omr' in payload:
        project.order_value_omr = _to_decimal_or_none(payload.get('order_value_omr'))
    status_name = to_title_case(payload.get('status', project.status.name if project.status else ''))
    project.status = None
    if status_name:
        project.status, _ = ProjectStatusOption.objects.get_or_create(name=status_name)
    project.expected_customer_need_date = _to_date(
        payload.get('expected_customer_need_date', project.expected_customer_need_date)
    )
    project.save()
    return JsonResponse({'success': True, 'project': _serialize(project)})

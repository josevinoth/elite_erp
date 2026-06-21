import datetime

from django.contrib.auth.models import User
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from ..serializers import ProjectSerializer
from ..sub_models import Project, ProjectStatusOption
from ..utils import normalize_text, to_title_case


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
        'updated_by': project.updated_by.id if project.updated_by else None,
        'order_value_omr': '' if project.order_value_omr is None else str(project.order_value_omr),
        'status': project.status.name if project.status else '',
        'expected_customer_need_date': str(
            project.expected_customer_need_date) if project.expected_customer_need_date else '',
    }


def _project_exists_case_insensitive(project_id, project_name, exclude_id=None):
    qs = Project.objects.filter(
        project_id__iexact=project_id,
        project_name__iexact=project_name,
    )
    if exclude_id is not None:
        qs = qs.exclude(id=exclude_id)
    return qs.exists()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_project_lifecycle_meta_api_view(request):
    statuses = list(ProjectStatusOption.objects.order_by("name").values_list("name", flat=True))
    return Response({"statuses": statuses}, status=status.HTTP_200_OK)



@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_project_lifecycle_status_option_api_view(request):
    payload = request.data or {}
    name = to_title_case(payload.get("name", ""))
    if not name:
        return Response({"message": "Status name is required."}, status=status.HTTP_400_BAD_REQUEST)

    obj, _created = ProjectStatusOption.objects.get_or_create(name=name)
    return Response({"success": True, "name": obj.name}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_projects_api_view(request):
    projects = Project.objects.order_by('-id')
    serializer = ProjectSerializer(projects, many=True)
    return Response({'projects': serializer.data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_project_api_view(request):
    payload = request.data or {}
    project_id = normalize_text(payload.get('project_id', ''))
    project_name = normalize_text(payload.get('project_name', ''))
    if not project_id:
        return Response({'message': 'Project ID is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if _project_exists_case_insensitive(project_id, project_name):
        return Response({'message': 'Duplicate project exists (case-insensitive match).'}, status=status.HTTP_400_BAD_REQUEST)
    status_name = to_title_case(payload.get('status', ''))
    status_obj = None
    if status_name:
        status_obj, _ = ProjectStatusOption.objects.get_or_create(name=status_name)
    user_id = payload.get('updated_by')
    if user_id:
        try:
            updated_by_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'message': 'Invalid updated_by user.'}, status=status.HTTP_400_BAD_REQUEST)
    else:
        updated_by_user = request.user

    project = Project.objects.create(
        project_id=project_id,
        description=normalize_text(payload.get('description', '')),
        project_name=project_name,
        proposal_date=_to_date(payload.get('proposal_date')),
        updated_by=updated_by_user,
        order_value_omr=_to_decimal_or_none(payload.get('order_value_omr')),
        status=status_obj,
        expected_customer_need_date=_to_date(payload.get('expected_customer_need_date')),
    )
    return Response({'success': True, 'project': _serialize(project)}, status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def project_detail_api_view(request, project_id):
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return Response({'message': 'Project not found.'}, status=status.HTTP_404_NOT_FOUND)
    if request.method == 'DELETE':
        project.delete()
        return Response({'success': True, 'message': 'Project deleted.'}, status=status.HTTP_200_OK)

    payload = request.data or {}
    project_id = normalize_text(payload.get('project_id', project.project_id))
    project_name = normalize_text(payload.get('project_name', project.project_name))
    user_id = payload.get('updated_by')
    if not project_id:
        return Response({'message': 'Project ID is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if _project_exists_case_insensitive(project_id, project_name, exclude_id=project.id):
        return Response({'message': 'Duplicate project exists (case-insensitive match).'}, status=status.HTTP_400_BAD_REQUEST)
    project.project_id = project_id
    project.description = normalize_text(payload.get('description', project.description))
    project.project_name = project_name
    project.proposal_date = _to_date(payload.get('proposal_date', project.proposal_date))
    if user_id:
        try:
            project.updated_by = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'message': 'Invalid updated_by user.'}, status=status.HTTP_400_BAD_REQUEST)
    else:
        project.updated_by = request.user
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
    return Response({'success': True, 'project': _serialize(project)}, status=status.HTTP_200_OK)

import datetime

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from ..serializers import ProjectSerializer
from ..sub_models import Project, ProjectStatusOption
from ..sub_models.yes_no_mod import yesno_info
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
        return datetime.date.fromisoformat(str(value).split(' ')[0].split('T')[0])
    except (TypeError, ValueError, AttributeError):
        return None


def _resolve_yesno_option(value):
    if value in (None, ''):
        return None
    try:
        return yesno_info.objects.get(id=int(value))
    except (TypeError, ValueError, yesno_info.DoesNotExist):
        raise ValueError('Invalid yes/no option.')


def _serialize(project):
    return {
        'id': project.id,
        'project_id': project.project_id,
        'description': project.description,
        'project_name': project.project_name,
        'project_location': project.project_location,
        'proposal_date': str(project.proposal_date) if project.proposal_date else '',
        'material_required_date': str(project.material_required_date) if project.material_required_date else '',
        'project_completion_date': str(project.project_completion_date) if project.project_completion_date else '',
        'mas_approved': project.mas_approved_id,
        'advance_payment_received': project.advance_payment_received_id,
        'prod_dwg_issued': project.prod_dwg_issued_id,
        'prod_dwg_issued_justification': project.prod_dwg_issued_justification,
        'prod_dwg_release_date': str(project.prod_dwg_release_date) if project.prod_dwg_release_date else '',
        'prod_dwg_issued_sf': project.prod_dwg_issued_sf_id,
        'prod_dwg_issued_sf_justification': project.prod_dwg_issued_sf_justification,
        'prod_dwg_release_date_sf': str(project.prod_dwg_release_date_sf) if project.prod_dwg_release_date_sf else '',
        'mas_justification': project.mas_justification,
        'drawing_approved': project.drawing_approved_id,
        'drawing_justification': project.drawing_justification,
        'prev_proj_replica': project.prev_proj_replica_id,
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
    yes_no_options = [
        {"value": str(option.id), "label": option.yn_value}
        for option in yesno_info.objects.order_by("-yn_value")
    ]
    return Response({"statuses": statuses, "yes_no_options": yes_no_options}, status=status.HTTP_200_OK)



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

    try:
        mas_approved = _resolve_yesno_option(payload.get('mas_approved'))
        advance_payment_received = _resolve_yesno_option(payload.get('advance_payment_received'))
        prod_dwg_issued = _resolve_yesno_option(payload.get('prod_dwg_issued'))
        prod_dwg_issued_sf = _resolve_yesno_option(payload.get('prod_dwg_issued_sf'))
        drawing_approved = _resolve_yesno_option(payload.get('drawing_approved'))
        prev_proj_replica = _resolve_yesno_option(payload.get('prev_proj_replica'))
    except ValueError as exc:
        return Response({'message': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    create_kwargs = {
        'project_id': project_id,
        'description': normalize_text(payload.get('description', '')),
        'project_name': project_name,
        'project_location': normalize_text(payload.get('project_location', '')),
        'proposal_date': _to_date(payload.get('proposal_date')),
        'material_required_date': _to_date(payload.get('material_required_date')),
        'project_completion_date': _to_date(payload.get('project_completion_date')),
        'prod_dwg_issued_justification': normalize_text(payload.get('prod_dwg_issued_justification', '')),
        'prod_dwg_release_date': _to_date(payload.get('prod_dwg_release_date')),
        'prod_dwg_issued_sf_justification': normalize_text(payload.get('prod_dwg_issued_sf_justification', '')),
        'prod_dwg_release_date_sf': _to_date(payload.get('prod_dwg_release_date_sf')),
        'mas_justification': normalize_text(payload.get('mas_justification', '')),
        'drawing_justification': normalize_text(payload.get('drawing_justification', '')),
        'updated_by': request.user,
        'order_value_omr': _to_decimal_or_none(payload.get('order_value_omr')),
        'status': status_obj,
        'expected_customer_need_date': _to_date(payload.get('expected_customer_need_date')),
    }

    if mas_approved is not None:
        create_kwargs['mas_approved'] = mas_approved
    if advance_payment_received is not None:
        create_kwargs['advance_payment_received'] = advance_payment_received
    if prod_dwg_issued is not None:
        create_kwargs['prod_dwg_issued'] = prod_dwg_issued
    if prod_dwg_issued_sf is not None:
        create_kwargs['prod_dwg_issued_sf'] = prod_dwg_issued_sf
    if drawing_approved is not None:
        create_kwargs['drawing_approved'] = drawing_approved
    if prev_proj_replica is not None:
        create_kwargs['prev_proj_replica'] = prev_proj_replica

    project = Project.objects.create(
        **create_kwargs,
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
    if not project_id:
        return Response({'message': 'Project ID is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if _project_exists_case_insensitive(project_id, project_name, exclude_id=project.id):
        return Response({'message': 'Duplicate project exists (case-insensitive match).'}, status=status.HTTP_400_BAD_REQUEST)
    project.project_id = project_id
    project.description = normalize_text(payload.get('description', project.description))
    project.project_name = project_name
    project.project_location = normalize_text(payload.get('project_location', project.project_location))
    project.proposal_date = _to_date(payload.get('proposal_date', project.proposal_date))
    project.material_required_date = _to_date(payload.get('material_required_date', project.material_required_date))
    project.project_completion_date = _to_date(payload.get('project_completion_date', project.project_completion_date))
    project.prod_dwg_issued_justification = normalize_text(
        payload.get('prod_dwg_issued_justification', project.prod_dwg_issued_justification)
    )
    project.prod_dwg_release_date = _to_date(payload.get('prod_dwg_release_date', project.prod_dwg_release_date))
    project.prod_dwg_issued_sf_justification = normalize_text(
        payload.get('prod_dwg_issued_sf_justification', project.prod_dwg_issued_sf_justification)
    )
    project.prod_dwg_release_date_sf = _to_date(payload.get('prod_dwg_release_date_sf', project.prod_dwg_release_date_sf))
    project.mas_justification = normalize_text(payload.get('mas_justification', project.mas_justification))
    project.drawing_justification = normalize_text(payload.get('drawing_justification', project.drawing_justification))
    project.updated_by = request.user

    yesno_fields = [
        'mas_approved',
        'advance_payment_received',
        'prod_dwg_issued',
        'prod_dwg_issued_sf',
        'drawing_approved',
        'prev_proj_replica',
    ]
    for field_name in yesno_fields:
        if field_name in payload and payload.get(field_name) not in (None, ''):
            try:
                setattr(project, field_name, _resolve_yesno_option(payload.get(field_name)))
            except ValueError as exc:
                return Response({'message': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

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

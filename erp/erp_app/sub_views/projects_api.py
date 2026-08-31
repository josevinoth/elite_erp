import datetime
import json

from django.db import transaction
from django.contrib.auth.models import User

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from ..project_serializer import ProjectSerializer
from ..sub_models import Project, ProjectStatusOption
from ..sub_models.approval_status_mod import ApprovalStatus_info
from ..sub_models.non_moe_product_series_mod import NonMOEProductSeries_info
from ..sub_models.non_standard_lab_mod import NonStandardLab_info
from ..sub_models.project_category_mod import ProjectCategory_info
from ..sub_models.project_layout_drawing import ProjectLayoutDrawing
from ..sub_models.project_sub_category_mod import ProjectSubCategory_info
from ..sub_models.standard_lab_mod import StandardLab_info
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


def _resolve_fk_option(model_cls, value, error_message):
    if value in (None, ''):
        return None
    try:
        return model_cls.objects.get(id=int(value))
    except (TypeError, ValueError, model_cls.DoesNotExist):
        raise ValueError(error_message)


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
        'project_category': project.project_category_id,
        'project_sub_category': project.project_sub_category_id,
        'standard_lab': project.standard_lab_id,
        'non_standard_lab': project.non_standard_lab_id,
        'non_moe_product_series': project.non_moe_product_series_id,
        'updated_by': project.updated_by.id if project.updated_by else None,
        'project_owner': project.project_owner_id,
        'project_owner_name': project.project_owner.username if project.project_owner else '',
        'order_value_omr': '' if project.order_value_omr is None else str(project.order_value_omr),
        'status': project.status.name if project.status else '',
        'expected_customer_need_date': str(
            project.expected_customer_need_date) if project.expected_customer_need_date else '',
    }


def _serialize_layout_drawing(drawing, user=None):
    user_id = user.id if getattr(user, 'is_authenticated', False) else None
    is_admin = _is_admin_user(user) if user_id else False
    file_url = ''
    try:
        file_url = drawing.file.url if drawing.file else ''
    except (ValueError, FileNotFoundError, OSError):
        file_url = ''
    file_name = str(getattr(drawing.file, 'name', '')).split('/')[-1] if drawing.file else ''
    return {
        'id': drawing.id,
        'drawing_name': drawing.drawing_name,
        'file_url': file_url,
        'file_name': file_name,
        'level_one_approver': drawing.level_one_approver_id,
        'level_one_approver_name': drawing.level_one_approver.username if drawing.level_one_approver else '',
        'level_one_status': drawing.level_one_status_id,
        'level_one_message': drawing.level_one_message,
        'can_edit': bool(user_id),
        'can_edit_level_one': bool(is_admin or (user_id and drawing.level_one_approver_id == user_id)),
    }


def _parse_rows_payload(rows_raw):
    if rows_raw in (None, ''):
        return []
    if isinstance(rows_raw, list):
        return rows_raw
    if isinstance(rows_raw, dict):
        return [rows_raw]
    try:
        loaded = json.loads(str(rows_raw))
    except (TypeError, ValueError):
        raise ValueError('Invalid layout drawing rows payload.')
    if isinstance(loaded, list):
        return loaded
    if isinstance(loaded, dict):
        return [loaded]
    raise ValueError('Invalid layout drawing rows payload.')


def _to_int_or_none(value):
    try:
        if value in (None, ''):
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _is_admin_user(user):
    if user.is_superuser or user.is_staff:
        return True
    group_names = {g.name.strip().lower() for g in user.groups.all()}
    return bool(group_names.intersection({'admin', 'super admin', 'staff'}))


def _is_assigned_approver(drawing, user):
    if not user or not user.is_authenticated:
        return False
    return drawing.level_one_approver_id == user.id


def _is_awaiting_status(status_obj):
    if not status_obj:
        return False
    return status_obj.id == 3 or str(getattr(status_obj, 'as_name', '')).strip().lower() == 'awaiting for approval'


def _can_user_edit_layout_drawing(drawing, user):
    return _is_admin_user(user) or _is_assigned_approver(drawing, user)


def _project_exists_case_insensitive(project_id, project_name, exclude_id=None):
    qs = Project.objects.filter(
        project_id__iexact=project_id,
        project_name__iexact=project_name,
    )
    if exclude_id is not None:
        qs = qs.exclude(id=exclude_id)
    return qs.exists()


def _get_default_project_status():
    return ProjectStatusOption.objects.filter(pk=17).first() or ProjectStatusOption.objects.order_by("name").first()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_project_lifecycle_meta_api_view(request):
    statuses = list(ProjectStatusOption.objects.order_by("name").values_list("name", flat=True))
    default_status = _get_default_project_status()
    yes_no_options = [
        {"value": str(option.id), "label": option.yn_value}
        for option in yesno_info.objects.order_by("-yn_value")
    ]

    project_categories = [
        {"value": str(option.id), "label": option.pc_name}
        for option in ProjectCategory_info.objects.order_by("pc_name")
    ]
    project_sub_categories = [
        {"value": str(option.id), "label": option.psc_name}
        for option in ProjectSubCategory_info.objects.order_by("psc_name")
    ]
    standard_labs = [
        {"value": str(option.id), "label": option.sl_name}
        for option in StandardLab_info.objects.order_by("sl_name")
    ]
    non_standard_labs = [
        {"value": str(option.id), "label": option.nsl_name}
        for option in NonStandardLab_info.objects.order_by("nsl_name")
    ]
    non_moe_product_series = [
        {"value": str(option.id), "label": option.nmps_name}
        for option in NonMOEProductSeries_info.objects.order_by("nmps_name")
    ]
    approval_statuses = [
        {"value": str(option.id), "label": option.as_name}
        for option in ApprovalStatus_info.objects.order_by("as_name")
    ]
    approvers = [
        {"value": str(user.id), "label": user.username}
        for user in User.objects.filter(is_active=True).order_by('username')
    ]
    project_owners = [
        {"value": str(user.id), "label": user.username}
        for user in User.objects.filter(is_active=True).order_by('username')
    ]
    return Response(
        {
            "statuses": statuses,
            "default_status": default_status.name if default_status else "",
            "yes_no_options": yes_no_options,
            "project_categories": project_categories,
            "project_sub_categories": project_sub_categories,
            "standard_labs": standard_labs,
            "non_standard_labs": non_standard_labs,
            "non_moe_product_series": non_moe_product_series,
            "approval_statuses": approval_statuses,
            "approvers": approvers,
            "project_owners": project_owners,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_project_layout_drawings_api_view(request, project_id):
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return Response({'message': 'Project not found.'}, status=status.HTTP_404_NOT_FOUND)

    drawings = (
        ProjectLayoutDrawing.objects.filter(project=project)
        .select_related('level_one_status', 'level_one_approver')
        .order_by('id')
    )
    return Response({'drawings': [_serialize_layout_drawing(d, request.user) for d in drawings]}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_layout_drawing_approvals_api_view(request):
    only_awaiting = str(request.GET.get('awaiting_only', '1')).strip().lower() not in {'0', 'false', 'no'}
    queryset = ProjectLayoutDrawing.objects.select_related(
        'project',
        'level_one_status',
        'level_one_approver',
    )

    if not _is_admin_user(request.user):
        queryset = queryset.filter(level_one_approver=request.user)

    rows = []
    for drawing in queryset.order_by('-updated_at', '-id'):
        level_one_pending = bool(drawing.level_one_approver_id) and _is_awaiting_status(drawing.level_one_status)
        if only_awaiting and not level_one_pending:
            continue

        if not _is_admin_user(request.user):
            assigned_pending = drawing.level_one_approver_id == request.user.id and level_one_pending
            if only_awaiting and not assigned_pending:
                continue

        rows.append(
            {
                'drawing_id': drawing.id,
                'project_id': drawing.project_id,
                'project_code': drawing.project.project_id,
                'project_name': drawing.project.project_name,
                'drawing_name': drawing.drawing_name,
                'approver_name': drawing.level_one_approver.username if drawing.level_one_approver else '',
                'approver_status': drawing.level_one_status.as_name if drawing.level_one_status else '',
                'updated_at': drawing.updated_at.isoformat() if drawing.updated_at else '',
                'edit_url': f'/projects/record/{drawing.project_id}?section=layout-drawing&layoutDrawingId={drawing.id}',
            }
        )

    return Response({'records': rows}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_project_layout_drawings_api_view(request, project_id):
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return Response({'message': 'Project not found.'}, status=status.HTTP_404_NOT_FOUND)

    try:
        rows = _parse_rows_payload(request.data.get('rows'))
    except ValueError as exc:
        return Response({'message': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    existing_by_id = {
        obj.id: obj
        for obj in ProjectLayoutDrawing.objects.filter(project=project).select_related(
            'level_one_status',
            'level_one_approver',
        )
    }
    kept_drawing_ids = set()
    is_admin = _is_admin_user(request.user)
    default_awaiting_status = ApprovalStatus_info.objects.filter(pk=3).first()

    uploaded_files_by_key = {
        key: request.FILES.getlist(key)
        for key in request.FILES.keys()
    }
    consumed_upload_keys = set()

    try:
        with transaction.atomic():
            for index, row in enumerate(rows):
                if not isinstance(row, dict):
                    raise ValueError('Each layout drawing row must be an object.')

                row_id = row.get('id')
                temp_id = str(row.get('temp_id') or row_id or f'row_{index}')
                has_new_file = bool(_to_int_or_none(row.get('new_file_count')))
                clear_file = bool(row.get('clear_file'))

                requested_level_one_status = _resolve_fk_option(
                    ApprovalStatus_info,
                    row.get('level_one_status'),
                    'Invalid level one approval status.',
                )
                requested_level_one_approver = _resolve_fk_option(
                    User,
                    row.get('level_one_approver'),
                    'Invalid level one approver.',
                )

                if row_id in (None, ''):
                    drawing = ProjectLayoutDrawing(project=project)
                else:
                    try:
                        drawing = existing_by_id[int(row_id)]
                    except (TypeError, ValueError, KeyError):
                        raise ValueError('Invalid layout drawing row id.')

                drawing.drawing_name = normalize_text(row.get('drawing_name', ''))
                row_level_one_message = normalize_text(row.get('level_one_message', ''))

                if row_id in (None, ''):
                    drawing.level_one_approver = requested_level_one_approver
                    drawing.level_one_status = requested_level_one_status or default_awaiting_status
                    drawing.level_one_message = row_level_one_message
                elif is_admin:
                    drawing.level_one_approver = requested_level_one_approver
                    drawing.level_one_status = requested_level_one_status or default_awaiting_status
                    drawing.level_one_message = row_level_one_message
                else:
                    if drawing.level_one_approver_id == request.user.id:
                        drawing.level_one_status = requested_level_one_status or drawing.level_one_status or default_awaiting_status
                        drawing.level_one_message = row_level_one_message
                    elif requested_level_one_status and _to_int_or_none(row.get('level_one_status')) != drawing.level_one_status_id:
                        raise ValueError('Only assigned level one approver can update level one status.')

                if not drawing.level_one_status:
                    drawing.level_one_status = default_awaiting_status

                # Handle file: find uploaded file for this row
                uploaded_file = None
                if has_new_file:
                    file_lookup_keys = [
                        f'files_{temp_id}',
                        f'files_{row_id}',
                        f'files_row_{index}',
                    ]
                    for lookup_key in file_lookup_keys:
                        if not lookup_key or lookup_key in consumed_upload_keys:
                            continue
                        candidates = uploaded_files_by_key.get(lookup_key) or []
                        if candidates:
                            uploaded_file = candidates[0]
                            consumed_upload_keys.add(lookup_key)
                            break

                    # Fallback: one unconsumed key remaining
                    if not uploaded_file:
                        remaining = [
                            (k, v) for k, v in uploaded_files_by_key.items()
                            if k not in consumed_upload_keys and str(k).startswith('files_') and v
                        ]
                        if len(remaining) == 1:
                            uploaded_file = remaining[0][1][0]
                            consumed_upload_keys.add(remaining[0][0])

                    if not uploaded_file:
                        raise ValueError(
                            f'Drawing row {index + 1}: expected a file upload but none was received. '
                            'Please reselect the file and save again.'
                        )

                    # Replace existing file with new upload
                    if drawing.file:
                        drawing.file.delete(save=False)
                    drawing.file = uploaded_file

                elif clear_file:
                    # User explicitly removed the file
                    if drawing.file:
                        drawing.file.delete(save=False)
                    drawing.file = None

                # Auto-populate drawing_name from uploaded file name if still blank
                if not drawing.drawing_name and uploaded_file:
                    drawing.drawing_name = normalize_text(getattr(uploaded_file, 'name', ''))

                if row_id in (None, '') and not drawing.file:
                    raise ValueError(
                        f'Drawing row {index + 1} requires a file before it can be saved.'
                    )

                drawing.save()
                kept_drawing_ids.add(drawing.id)

            rows_to_delete = ProjectLayoutDrawing.objects.filter(project=project).exclude(id__in=kept_drawing_ids)
            if not is_admin:
                for row_to_delete in rows_to_delete:
                    if not _can_user_edit_layout_drawing(row_to_delete, request.user):
                        raise ValueError('Only assigned approver or admin can delete this drawing row.')
            rows_to_delete.delete()

            remaining_upload_keys = [
                key for key in uploaded_files_by_key.keys()
                if str(key).startswith('files_') and key not in consumed_upload_keys
            ]
            if remaining_upload_keys:
                raise ValueError('Some uploaded files could not be matched to drawing rows. Please retry save.')
    except ValueError as exc:
        return Response({'message': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    drawings = (
        ProjectLayoutDrawing.objects.filter(project=project)
        .select_related('level_one_status', 'level_one_approver')
        .order_by('id')
    )
    return Response({'success': True, 'drawings': [_serialize_layout_drawing(d, request.user) for d in drawings]}, status=status.HTTP_200_OK)



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
    else:
        status_obj = _get_default_project_status()

    try:
        mas_approved = _resolve_yesno_option(payload.get('mas_approved'))
        advance_payment_received = _resolve_yesno_option(payload.get('advance_payment_received'))
        prod_dwg_issued = _resolve_yesno_option(payload.get('prod_dwg_issued'))
        prod_dwg_issued_sf = _resolve_yesno_option(payload.get('prod_dwg_issued_sf'))
        drawing_approved = _resolve_yesno_option(payload.get('drawing_approved'))
        prev_proj_replica = _resolve_yesno_option(payload.get('prev_proj_replica'))
        project_category = _resolve_fk_option(ProjectCategory_info, payload.get('project_category'), 'Invalid project category.')
        project_sub_category = _resolve_fk_option(ProjectSubCategory_info, payload.get('project_sub_category'), 'Invalid project sub-category.')
        standard_lab = _resolve_fk_option(StandardLab_info, payload.get('standard_lab'), 'Invalid standard lab.')
        non_standard_lab = _resolve_fk_option(NonStandardLab_info, payload.get('non_standard_lab'), 'Invalid non-standard lab.')
        non_moe_product_series = _resolve_fk_option(NonMOEProductSeries_info, payload.get('non_moe_product_series'), 'Invalid non-MOE product series.')
        project_owner = _resolve_fk_option(User, payload.get('project_owner'), 'Invalid project owner.')
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
    if project_category is not None:
        create_kwargs['project_category'] = project_category
    if project_sub_category is not None:
        create_kwargs['project_sub_category'] = project_sub_category
    if standard_lab is not None:
        create_kwargs['standard_lab'] = standard_lab
    if non_standard_lab is not None:
        create_kwargs['non_standard_lab'] = non_standard_lab
    if non_moe_product_series is not None:
        create_kwargs['non_moe_product_series'] = non_moe_product_series
    if project_owner is not None:
        create_kwargs['project_owner'] = project_owner

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

    fk_field_map = {
        'project_category': (ProjectCategory_info, 'Invalid project category.'),
        'project_sub_category': (ProjectSubCategory_info, 'Invalid project sub-category.'),
        'standard_lab': (StandardLab_info, 'Invalid standard lab.'),
        'non_standard_lab': (NonStandardLab_info, 'Invalid non-standard lab.'),
        'non_moe_product_series': (NonMOEProductSeries_info, 'Invalid non-MOE product series.'),
        'project_owner': (User, 'Invalid project owner.'),
    }
    for field_name, (model_cls, error_message) in fk_field_map.items():
        if field_name in payload and payload.get(field_name) not in (None, ''):
            try:
                setattr(project, field_name, _resolve_fk_option(model_cls, payload.get(field_name), error_message))
            except ValueError as exc:
                return Response({'message': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    if 'order_value_omr' in payload:
        project.order_value_omr = _to_decimal_or_none(payload.get('order_value_omr'))
    status_name = to_title_case(payload.get('status', project.status.name if project.status else ''))
    if status_name:
        project.status, _ = ProjectStatusOption.objects.get_or_create(name=status_name)
    elif project.status is None:
        project.status = _get_default_project_status()
    project.expected_customer_need_date = _to_date(
        payload.get('expected_customer_need_date', project.expected_customer_need_date)
    )
    if 'project_owner' in payload and payload.get('project_owner') in (None, ''):
        project.project_owner = None
    project.save()
    return Response({'success': True, 'project': _serialize(project)}, status=status.HTTP_200_OK)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def project_edit_api_view(request, project_id):
    return project_detail_api_view(request, project_id)


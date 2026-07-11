from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from ..serializers import ProjectLayoutDrawingSerializer
from ..sub_models import ProjectLayoutDrawing


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_project_layout_drawings(request, project_id):
    drawings = ProjectLayoutDrawing.objects.filter(project_id=project_id).order_by("id")
    serializer = ProjectLayoutDrawingSerializer(drawings, many=True, context={"request": request})
    return Response({"records": serializer.data})

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def upload_project_layout_drawing(request, project_id):
    drawing_name = request.data.get("drawing_name", "")
    file = request.FILES.get("file")

    if not file:
        return Response({"message": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

    drawing = ProjectLayoutDrawing.objects.create(
        project_id=project_id,
        drawing_name=drawing_name,
        file=file,
        level_one_approver=request.user,  # example default
    )

    serializer = ProjectLayoutDrawingSerializer(drawing, context={"request": request})
    return Response(serializer.data, status=status.HTTP_201_CREATED)

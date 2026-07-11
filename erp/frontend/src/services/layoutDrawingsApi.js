export async function uploadLayoutDrawing(projectId, drawingName, file) {
  const formData = new FormData();
  formData.append("drawing_name", drawingName);
  formData.append("file", file);

  const res = await fetch(`/api/projects/${projectId}/layout-drawings/upload/`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  return res.json();
}

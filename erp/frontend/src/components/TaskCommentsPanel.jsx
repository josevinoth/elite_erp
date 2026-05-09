import { useCallback, useEffect, useMemo, useState } from "react";
import { createComment, deleteCommentAttachment, listComments } from "../services/crudApi";

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "svg",
  "pdf",
  "doc", "docx", "txt", "rtf",
  "xls", "xlsx", "csv",
  "zip", "rar", "7z",
]);

function toLocalDatetimeInputValue(isoValue) {
  if (!isoValue) {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  }
  const dt = new Date(isoValue);
  if (Number.isNaN(dt.getTime())) return "";
  return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function toDisplayDateTime(value) {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  const day = String(dt.getDate()).padStart(2, "0");
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][dt.getMonth()];
  const year = dt.getFullYear();
  const datePart = `${day}-${month}-${year}`;
  const timePart = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(dt);
  return `${datePart} ${timePart}`;
}

function formatBytes(bytes) {
  const b = Number(bytes || 0);
  if (!b) return "";
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${b} B`;
}

function attachmentIcon(ext) {
  const e = String(ext || "").toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(e)) return "🖼️";
  if (["pdf"].includes(e)) return "📕";
  if (["doc", "docx", "txt", "rtf"].includes(e)) return "📄";
  if (["xls", "xlsx", "csv"].includes(e)) return "📊";
  if (["zip", "rar", "7z"].includes(e)) return "🗜️";
  return "📎";
}

function isAllowedAttachment(fileName) {
  const name = String(fileName || "");
  const idx = name.lastIndexOf(".");
  if (idx < 0) return false;
  const ext = name.slice(idx + 1).toLowerCase();
  return ALLOWED_ATTACHMENT_EXTENSIONS.has(ext);
}

function TaskCommentsPanel({ taskId, onCommentCreated = null }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newComment, setNewComment] = useState("");
  const [commentDateTime, setCommentDateTime] = useState(toLocalDatetimeInputValue(""));
  const [attachments, setAttachments] = useState([]);

  const canAddComment = !!taskId;

  const loadComments = useCallback(async () => {
    if (!taskId) {
      setComments([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await listComments("task", taskId);
      setComments(data.comments || []);
    } catch (err) {
      setError(err.message || "Failed to load comments.");
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const onAddComment = async () => {
    if (!canAddComment) return;

    const text = String(newComment || "").trim();
    if (!text) {
      setError("Comment text is required.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("module_name", "task");
      formData.append("record_id", String(taskId));
      formData.append("comment_datetime", commentDateTime);
      formData.append("comments", text);
      formData.append("reference_link", "");
      for (const file of attachments) {
        formData.append("attachments", file);
      }

      await createComment(formData);
      setNewComment("");
      setCommentDateTime(toLocalDatetimeInputValue(""));
      setAttachments([]);
      await loadComments();
      if (typeof onCommentCreated === "function") {
        onCommentCreated();
      }
    } catch (err) {
      setError(err.message || "Unable to add comment.");
    } finally {
      setSaving(false);
    }
  };

  const onDeleteAttachment = async (attachmentId) => {
    if (!window.confirm("Delete this attachment?")) return;
    setError("");
    try {
      await deleteCommentAttachment(attachmentId);
      await loadComments();
    } catch (err) {
      setError(err.message || "Unable to delete attachment.");
    }
  };

  const onSelectAttachments = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      setAttachments([]);
      return;
    }

    const invalidType = files.find((f) => !isAllowedAttachment(f.name));
    if (invalidType) {
      setError(`Unsupported file type: ${invalidType.name}`);
      event.target.value = "";
      return;
    }

    const invalidSize = files.find((f) => Number(f.size || 0) > MAX_ATTACHMENT_SIZE_BYTES);
    if (invalidSize) {
      setError(`File too large: ${invalidSize.name}. Max size is 10 MB.`);
      event.target.value = "";
      return;
    }

    setError("");
    setAttachments(files);
  };

  const sortedComments = useMemo(
    () => [...comments].sort((a, b) => String(b.comment_datetime || "").localeCompare(String(a.comment_datetime || ""))),
    [comments]
  );

  if (!taskId) {
    return (
      <div className="task-comments-panel">
        <p className="users-status">Save the task first, then add comments.</p>
      </div>
    );
  }

  return (
    <div className="task-comments-panel">
      <div className="task-comments-panel__head">
        <h3 className="task-comments-panel__title">Task Comments</h3>
      </div>

      {error ? <p className="users-status users-status--error">{error}</p> : null}

      <div className="task-comments-panel__new">

        <div className="modal-form__row">
          <label className="modal-form__label" htmlFor="task-comment-datetime">Date & Time *</label>
          <input
            id="task-comment-datetime"
            type="datetime-local"
            className="auth-input"
            value={commentDateTime}
            onChange={(e) => setCommentDateTime(e.target.value)}
          />
        </div>

        <div className="modal-form__row">
          <label className="modal-form__label" htmlFor="task-comment-text">New Comment *</label>
          <textarea
            id="task-comment-text"
            className="auth-input modal-form__textarea"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add your comment..."
          />
        </div>

        <div className="modal-form__row">
          <label className="modal-form__label" htmlFor="task-comment-attachments">Attachments</label>
          <input
            id="task-comment-attachments"
            type="file"
            className="auth-input"
            multiple
            onChange={onSelectAttachments}
          />
          {attachments.length > 0 ? (
            <div style={{ display: "grid", gap: "0.2rem" }}>
              <small className="users-status">{attachments.length} file(s) selected</small>
              <div style={{ display: "grid", gap: "0.15rem" }}>
                {attachments.map((f) => (
                  <small key={`${f.name}-${f.size}`} className="users-status">
                    {attachmentIcon((f.name.split(".").pop() || "").toLowerCase())} {f.name} ({formatBytes(f.size)})
                  </small>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="task-comments-panel__add-btn-wrap">
          <button
            type="button"
            className="modal-btn modal-btn--save"
            onClick={onAddComment}
            disabled={saving}
          >
            {saving ? "Adding..." : "Add Comment"}
          </button>
        </div>
      </div>

      <div className="task-comments-panel__list">
        {loading ? <p className="users-status">Loading comments...</p> : null}
        {!loading && sortedComments.length === 0 ? (
          <p className="users-status">No comments yet.</p>
        ) : null}

        {!loading && sortedComments.length > 0 ? (
          <div className="users-table-wrap" style={{ maxHeight: "14rem", overflowY: "auto" }}>
            <table className="users-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Updated By</th>
                  <th>Comments</th>
                  <th>Attachments</th>
                </tr>
              </thead>
              <tbody>
                {sortedComments.map((c) => (
                  <tr key={c.id}>
                    <td>{toDisplayDateTime(c.comment_datetime)}</td>
                    <td>{c.updated_by}</td>
                    <td>{c.comments}</td>
                    <td>
                      {(c.attachments || []).length === 0 ? "" : (
                        <div style={{ display: "grid", gap: "0.2rem" }}>
                          {c.attachments.map((a) => (
                            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
                              <span title={a.ext || "file"}>{attachmentIcon(a.ext)}</span>
                              <a href={a.download_url} target="_blank" rel="noreferrer">{a.name}</a>
                              <small style={{ color: "#cce8e5" }}>{formatBytes(a.size)}</small>
                              {a.is_image ? (
                                <a href={a.view_url || a.download_url} target="_blank" rel="noreferrer">
                                  Preview
                                </a>
                              ) : null}
                              {c.can_edit ? (
                                <button
                                  type="button"
                                  className="modal-btn modal-btn--cancel"
                                  style={{ padding: "0.1rem 0.45rem", fontSize: "0.72rem" }}
                                  onClick={() => onDeleteAttachment(a.id)}
                                >
                                  Delete
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default TaskCommentsPanel;


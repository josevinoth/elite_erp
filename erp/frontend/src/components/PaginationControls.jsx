function PaginationControls({
  page,
  setPage,
  pageSize,
  totalCount,
  onPageSizeChange = null,
  pageSizeOptions = [10, 20, 50, 100],
}) {
  const safePageSize = Math.max(Number(pageSize || 1), 1);
  const totalPages = Math.max(1, Math.ceil(Number(totalCount || 0) / safePageSize));
  const start = totalCount > 0 ? (page - 1) * safePageSize + 1 : 0;
  const end = Math.min(page * safePageSize, Number(totalCount || 0));

  return (
    <div className="pagination-controls" style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
      {typeof onPageSizeChange === "function" ? (
        <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <span>Rows</span>
          <select
            className="users-table__filter-input"
            value={safePageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value) || 10)}
            style={{ minWidth: "5.5rem" }}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      ) : null}
      <button
        type="button"
        disabled={page === 1}
        onClick={() => setPage((prev) => prev - 1)}
      >
        Previous
      </button>
      <span>Page {page} / {totalPages}</span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => setPage((prev) => prev + 1)}
      >
        Next
      </button>
      <span style={{ marginLeft: "auto" }}>Showing {start}-{end} of {Number(totalCount || 0)}</span>
    </div>
  );
}

export default PaginationControls;


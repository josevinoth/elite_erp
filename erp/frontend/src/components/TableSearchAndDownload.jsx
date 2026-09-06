import { useState } from "react";
import { BsDownload } from "react-icons/bs";
import { exportRowsToExcel } from "../utils/exportToExcel";

/**
 * Reusable search toolbar matching CrudPage design
 * Renders: [Search Box] [...actions] [Download Excel] [Add Button]
 *
 * Props:
 *   rows - array of data rows to search and export
 *   columns - array of column definitions: [{ key, label }]
 *   title - name for the exported file
 *   onSearchChange - callback(searchText) when search input changes
 *   actions - array of action buttons to render between search and download
 *   onAddClick - callback for "Add New" button
 *   showAddButton - whether to show "Add New" button
 *   showDownloadButton - whether to show "Download Excel" button
 */
function TableSearchAndDownload({
  rows = [],
  columns = [],
  title = "Export",
  onSearchChange = null,
  actions = [],
  onAddClick = null,
  showAddButton = false,
  showDownloadButton = true,
}) {
  const [searchText, setSearchText] = useState("");
  const [exporting, setExporting] = useState(false);

  const handleSearchChange = (e) => {
    const text = e.target.value;
    setSearchText(text);
    if (onSearchChange) {
      onSearchChange(text);
    }
  };

  const handleDownload = async () => {
    setExporting(true);
    try {
      await exportRowsToExcel({
        fileName: title,
        sheetName: title,
        columns,
        rows,
      });
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export data: " + (err.message || "Unknown error"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="crud-page__header">
      <input
        type="search"
        className="crud-page__search-input"
        placeholder="Search all columns"
        value={searchText}
        onChange={handleSearchChange}
        aria-label="Search all columns"
      />
      <div className="crud-page__header-tools">
        {actions && actions.length > 0 && (
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {actions}
          </div>
        )}
        {showDownloadButton && (
          <button
            type="button"
            className="crud-add-btn"
            onClick={handleDownload}
            disabled={exporting || rows.length === 0}
            title={rows.length === 0 ? "No data to export" : "Download as Excel"}
          >
            <BsDownload aria-hidden="true" />
            <span>{exporting ? "Exporting..." : "Download Excel"}</span>
          </button>
        )}
        {showAddButton && onAddClick && (
          <button type="button" className="crud-add-btn" onClick={onAddClick}>
            <span>Add New</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default TableSearchAndDownload;


import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BsPencilSquare,
  BsPlusCircleFill,
  BsTrashFill,
  BsSearch,
  BsExclamationTriangleFill,
  BsShieldExclamation,
} from "react-icons/bs";
import { deleteVendor, getVendor, listVendors } from "../services/crudApi";
import "../styles/Vendor.css";

function VendorsListPage() {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    vendor: null,
    checking: false,
    deleting: false,
    downstreamLinks: [],
    error: "",
  });

  const loadVendors = useCallback(async () => {
    const data = await listVendors();
    setVendors(Array.isArray(data?.vendors) ? data.vendors : []);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadVendors()
      .catch((error) => {
        if (!alive) return;
        setStatus({ type: "error", message: error.message || "Failed to load vendors." });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [loadVendors]);

  const openDeleteModal = async (vendor) => {
    setDeleteModal({
      open: true,
      vendor,
      checking: true,
      deleting: false,
      downstreamLinks: [],
      error: "",
    });

    try {
      const data = await getVendor(vendor.id);
      const links = Array.isArray(data?.downstream_links)
        ? data.downstream_links
        : Array.isArray(data?.vendor?.downstream_links)
        ? data.vendor.downstream_links
        : [];
      setDeleteModal((prev) => ({
        ...prev,
        checking: false,
        downstreamLinks: links,
      }));
    } catch {
      setDeleteModal((prev) => ({
        ...prev,
        checking: false,
        downstreamLinks: [],
      }));
    }
  };

  const closeDeleteModal = () => {
    if (deleteModal.deleting) return;
    setDeleteModal({
      open: false,
      vendor: null,
      checking: false,
      deleting: false,
      downstreamLinks: [],
      error: "",
    });
  };

  const confirmDelete = async () => {
    if (!deleteModal.vendor || deleteModal.downstreamLinks.length > 0) return;
    setDeleteModal((prev) => ({ ...prev, deleting: true, error: "" }));

    try {
      await deleteVendor(deleteModal.vendor.id);
      await loadVendors();
      setStatus({ type: "success", message: `Vendor '${deleteModal.vendor.vendor_name}' deleted successfully.` });
      setDeleteModal({
        open: false,
        vendor: null,
        checking: false,
        deleting: false,
        downstreamLinks: [],
        error: "",
      });
    } catch (err) {
      setDeleteModal((prev) => ({
        ...prev,
        deleting: false,
        error: err.message || "Failed to delete vendor.",
      }));
    }
  };

  const filteredVendors = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter((v) =>
      [v.vendor_code, v.vendor_name, v.contact_person, v.phone_number, v.email_id, v.address]
        .some((val) => String(val || "").toLowerCase().includes(q))
    );
  }, [vendors, search]);

  return (
    <section className="module-page vendor-page">
      <div className="crud-page__header vendor-page__header">
        <h1 className="module-page__title module-page__title--vendors">Vendors</h1>
        <div className="crud-page__header-tools">
          <div className="vendor-search-wrap">
            <BsSearch className="vendor-search-icon" aria-hidden="true" />
            <input
              type="search"
              className="crud-page__search-input"
              placeholder="Search vendors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search vendors"
            />
          </div>
          <button
            type="button"
            className="crud-add-btn btn btn-primary"
            onClick={() => navigate("/vendors/add")}
          >
            <BsPlusCircleFill aria-hidden="true" />
            <span>Add Vendor</span>
          </button>
        </div>
      </div>

      {status.message ? (
        <p className={`users-status users-status--${status.type}`}>{status.message}</p>
      ) : null}

      {loading ? <p className="users-status">Loading vendors...</p> : null}

      {!loading ? (
        <div className="users-table-wrap vendor-table-wrap">
          <table className="users-table vendor-table">
            <thead>
              <tr>
                <th>Vendor Code</th>
                <th>Vendor Name</th>
                <th>Contact Person</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Address</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="vendor-table__empty">
                    {search ? "No vendors match your search." : "No vendors found."}
                  </td>
                </tr>
              ) : (
                filteredVendors.map((vendor) => (
                  <tr key={vendor.id}>
                    <td>{vendor.vendor_code || "-"}</td>
                    <td>{vendor.vendor_name || "-"}</td>
                    <td>{vendor.contact_person || "-"}</td>
                    <td>{vendor.phone_number || "-"}</td>
                    <td>{vendor.email_id || "-"}</td>
                    <td className="vendor-table__address">{vendor.address || "-"}</td>
                    <td>
                      <div className="vendor-table__actions">
                        <button
                          type="button"
                          className="users-action users-action--edit"
                          title="Edit"
                          onClick={() => navigate(`/vendors/edit/${vendor.id}`)}
                        >
                          <BsPencilSquare aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="users-action users-action--delete"
                          title="Delete"
                          onClick={() => openDeleteModal(vendor)}
                        >
                          <BsTrashFill aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {deleteModal.open && deleteModal.vendor ? (
        <div className="vendor-delete-modal-backdrop" role="presentation" onClick={closeDeleteModal}>
          <div
            className="vendor-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Delete Confirmation"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`vendor-delete-modal__head ${
                deleteModal.downstreamLinks.length > 0 ? "vendor-delete-modal__head--blocked" : ""
              }`}
            >
              <div className="vendor-delete-modal__title-wrap">
                {deleteModal.downstreamLinks.length > 0 ? (
                  <BsShieldExclamation className="vendor-delete-modal__icon--blocked" aria-hidden="true" />
                ) : (
                  <BsExclamationTriangleFill className="vendor-delete-modal__icon--warning" aria-hidden="true" />
                )}
                <h3 className="vendor-delete-modal__title">
                  {deleteModal.downstreamLinks.length > 0 ? "Cannot Delete Vendor" : "Confirm Delete Vendor"}
                </h3>
              </div>
              <button
                type="button"
                className="vendor-delete-modal__close"
                onClick={closeDeleteModal}
                disabled={deleteModal.deleting}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div className="vendor-delete-modal__body">
              {deleteModal.checking ? (
                <div className="vendor-delete-modal__loading">
                  <div className="vendor-delete-modal__spinner" />
                  <span>Checking downstream transactions...</span>
                </div>
              ) : (
                <>
                  {deleteModal.error ? (
                    <p className="users-status users-status--error">{deleteModal.error}</p>
                  ) : null}

                  {deleteModal.downstreamLinks.length > 0 ? (
                    <>
                      <div className="vendor-delete-modal__banner vendor-delete-modal__banner--blocked">
                        <strong>Deletion Blocked by System</strong>
                        <p>
                          This vendor is linked to {deleteModal.downstreamLinks.length} downstream record(s).
                          Vendors referenced by stock purchases or placed orders cannot be deleted.
                        </p>
                      </div>

                      <div className="vendor-delete-modal__vendor-info">
                        <div>
                          <span className="vendor-delete-modal__info-label">Vendor:</span>{" "}
                          <span className="vendor-delete-modal__info-val">{deleteModal.vendor.vendor_name}</span>
                        </div>
                        <div>
                          <span className="vendor-delete-modal__info-label">Code:</span>{" "}
                          <span className="vendor-delete-modal__info-val">{deleteModal.vendor.vendor_code || "-"}</span>
                        </div>
                      </div>

                      <span className="vendor-delete-modal__links-title">
                        Linked Records ({deleteModal.downstreamLinks.length}):
                      </span>

                      <div className="vendor-delete-modal__table-wrap">
                        <table className="vendor-delete-modal__table">
                          <thead>
                            <tr>
                              <th>Type</th>
                              <th>Reference</th>
                              <th>Date</th>
                              <th>Details</th>
                            </tr>
                          </thead>
                          <tbody>
                            {deleteModal.downstreamLinks.map((link, idx) => (
                              <tr key={idx}>
                                <td>
                                  <span className="vendor-delete-modal__type-badge">{link.type}</span>
                                </td>
                                <td className="vendor-delete-modal__ref">{link.reference}</td>
                                <td>{link.date || "-"}</td>
                                <td>{link.details || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="vendor-delete-modal__banner vendor-delete-modal__banner--safe">
                        <p className="vendor-delete-modal__message">
                          Are you sure you want to delete vendor <strong>{deleteModal.vendor.vendor_name}</strong>?
                        </p>
                      </div>

                      <div className="vendor-delete-modal__vendor-info">
                        <div>
                          <span className="vendor-delete-modal__info-label">Code:</span>{" "}
                          <span className="vendor-delete-modal__info-val">{deleteModal.vendor.vendor_code || "-"}</span>
                        </div>
                        <div>
                          <span className="vendor-delete-modal__info-label">Contact:</span>{" "}
                          <span className="vendor-delete-modal__info-val">{deleteModal.vendor.contact_person || "-"}</span>
                        </div>
                        <div>
                          <span className="vendor-delete-modal__info-label">Phone:</span>{" "}
                          <span className="vendor-delete-modal__info-val">{deleteModal.vendor.phone_number || "-"}</span>
                        </div>
                        <div>
                          <span className="vendor-delete-modal__info-label">Email:</span>{" "}
                          <span className="vendor-delete-modal__info-val">{deleteModal.vendor.email_id || "-"}</span>
                        </div>
                      </div>

                      <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b" }}>
                        This vendor has no linked downstream transactions. This action cannot be undone.
                      </p>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="vendor-delete-modal__footer">
              <button
                type="button"
                className="modal-btn modal-btn--cancel"
                onClick={closeDeleteModal}
                disabled={deleteModal.deleting}
              >
                {deleteModal.downstreamLinks.length > 0 ? "Close" : "Cancel"}
              </button>
              {deleteModal.downstreamLinks.length === 0 && !deleteModal.checking ? (
                <button
                  type="button"
                  className="modal-btn--danger"
                  onClick={confirmDelete}
                  disabled={deleteModal.deleting}
                >
                  <BsTrashFill aria-hidden="true" />
                  <span>{deleteModal.deleting ? "Deleting..." : "Delete Vendor"}</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default VendorsListPage;

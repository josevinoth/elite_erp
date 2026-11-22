import { useCallback } from "react";
import CrudPage from "../components/CrudPage";
import {
  checkCustomerDownstream,
  createCustomer,
  deleteCustomer,
  listCustomers,
  updateCustomer,
} from "../services/crudApi";

const COLUMNS = [
  { key: "customer_code", label: "Customer Code", width: "140px", minWidth: "120px" },
  { key: "name", label: "Customer Name", minWidth: "220px" },
  { key: "contact_number", label: "Contact Number", width: "160px", minWidth: "140px" },
  { key: "address", label: "Address", minWidth: "250px" },
  { key: "email", label: "Email", width: "180px", minWidth: "150px" },
];

const FIELDS = [
  { key: "name", label: "Customer Name", required: true, type: "text" },
  { key: "contact_number", label: "Contact Number", required: false, type: "text" },
  { key: "address", label: "Address", required: false, type: "textarea" },
  { key: "email", label: "Email", required: false, type: "text" },
];

function CustomersPage() {
  const fetchFn = useCallback(async () => {
    const data = await listCustomers();
    return Array.isArray(data.customers) ? data.customers : [];
  }, []);

  const createFn = useCallback(async (payload) => {
    const data = await createCustomer(payload);
    return data.customer;
  }, []);

  const updateFn = useCallback(async (id, payload) => {
    const data = await updateCustomer(id, payload);
    return data.customer;
  }, []);

  const deleteFn = useCallback(async (id) => {
    return await deleteCustomer(id);
  }, []);

  const checkDeleteAllowedFn = useCallback(async (row) => {
    try {
      const data = await checkCustomerDownstream(row.id);
      if (data?.has_downstream) {
        return {
          allowed: false,
          title: "Cannot Delete Customer",
          type: "warning",
          message: `Customer "${row.name || row.customer_name}" cannot be deleted because it is linked to active project(s).`,
          details: data.details || [],
          cancelLabel: "Close",
        };
      }
    } catch {
      // Fall through to normal confirm
    }
    return {
      allowed: true,
      title: "Confirm Delete Customer",
      type: "danger",
      message: `Are you sure you want to permanently delete customer "${row.name || row.customer_name}"? This action cannot be undone.`,
      confirmLabel: "Delete Customer",
      cancelLabel: "Cancel",
    };
  }, []);

  return (
    <CrudPage
      title="Customer Master"
      columns={COLUMNS}
      fields={FIELDS}
      fetchFn={fetchFn}
      createFn={createFn}
      updateFn={updateFn}
      deleteFn={deleteFn}
      checkDeleteAllowedFn={checkDeleteAllowedFn}
      includeAuditColumns={true}
      tableMaxHeight="60vh"
      stickyHeader
      defaultPageSize={20}
    />
  );
}

export default CustomersPage;


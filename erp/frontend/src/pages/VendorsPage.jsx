import { useCallback } from "react";
import CrudPage from "../components/CrudPage";
import {
  createVendor,
  deleteVendor,
  listVendors,
  updateVendor,
} from "../services/crudApi";

const COLUMNS = [
  { key: "name", label: "Vendor Name" },
  { key: "contact_person", label: "Contact Person" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
];

const FIELDS = [
  { key: "name", label: "Vendor Name", required: true },
  { key: "contact_person", label: "Contact Person" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "address", label: "Address", type: "textarea" },
];

function VendorsPage() {
  const fetchFn = useCallback(async () => {
    const data = await listVendors();
    return data.vendors || [];
  }, []);

  const createFn = useCallback(async (payload) => {
    const data = await createVendor(payload);
    return data.vendor;
  }, []);

  const updateFn = useCallback(async (id, payload) => {
    const data = await updateVendor(id, payload);
    return data.vendor;
  }, []);

  return (
    <CrudPage
      title="Vendors"
      columns={COLUMNS}
      fields={FIELDS}
      fetchFn={fetchFn}
      createFn={createFn}
      updateFn={updateFn}
      deleteFn={deleteVendor}
    />
  );
}

export default VendorsPage;


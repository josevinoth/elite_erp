import { useCallback, useMemo, useState } from "react";
import CrudPage from "../components/CrudPage";
import { deleteUser, listUsers, updateUserRole } from "../services/authApi";

const COLUMNS = [
  { key: "username", label: "User Name" },
  { key: "email", label: "Email" },
  { key: "role", label: "Role" },
  { key: "status", label: "Status" },
];

function toOptions(arr) {
  return (arr || []).map((name) => ({ value: name, label: name }));
}

function UsersManagementPage() {
  const [roleOptions, setRoleOptions] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);

  const fetchFn = useCallback(async () => {
    const data = await listUsers();
    setRoleOptions(Array.isArray(data.role_options) ? data.role_options : []);
    setStatusOptions(Array.isArray(data.status_options) ? data.status_options : []);
    return Array.isArray(data.users) ? data.users : [];
  }, []);

  const fields = useMemo(
    () => [
      {
        key: "role",
        label: "Role",
        required: true,
        options: toOptions(roleOptions),
      },
      {
        key: "status",
        label: "Status",
        required: true,
        options: toOptions(statusOptions),
      },
    ],
    [roleOptions, statusOptions]
  );

  const createFn = useCallback(async () => {
    throw new Error("User creation is not available on this page.");
  }, []);

  const updateFn = useCallback(async (id, payload) => {
    const data = await updateUserRole(id, payload.role || "", payload.status || "");
    return data.user;
  }, []);

  return (
    <CrudPage
      title="User List"
      columns={COLUMNS}
      fields={fields}
      fetchFn={fetchFn}
      createFn={createFn}
      updateFn={updateFn}
      deleteFn={deleteUser}
      showAddButton={false}
      stickyHeader
      tableMaxHeight="calc(100vh - 180px)"
    />
  );
}

export default UsersManagementPage;


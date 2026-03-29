import { useCallback, useEffect, useMemo, useState } from "react";
import CrudPage from "../components/CrudPage";
import {
  addExpenseItemOption,
  addExpenseSessionOption,
  addExpenseStatusOption,
  createCdcTeamExpence,
  deleteCdcTeamExpence,
  listCdcTeamExpenceMeta,
  listCdcTeamExpences,
  updateCdcTeamExpence,
} from "../services/crudApi";
import { getSessionUser } from "../services/sessionUser";

const COLUMNS = [
  { key: "expense_date", label: "Expense Date" },
  { key: "item_label", label: "Item" },
  { key: "session_label", label: "Session" },
  { key: "qty", label: "Qty" },
  { key: "price", label: "Price" },
  { key: "total_cost", label: "Total Cost" },
  { key: "status_label", label: "Status" },
  { key: "paid_by", label: "Paid By" },
  { key: "settled_on", label: "Settled On" },
  { key: "settled_by_label", label: "Settled By" },
];

function toNonNegativeInteger(value) {
  if (value === "" || value === null || value === undefined) return "0";
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed) || parsed < 0) return "0";
  return String(parsed);
}

function CdcTeamExpencePage() {
  const currentUser = useMemo(() => getSessionUser(), []);
  const isAdmin = useMemo(() => {
    const role = (currentUser?.role || "").trim().toLowerCase();
    return ["admin", "super admin", "staff"].includes(role);
  }, [currentUser]);

  const [itemOptions, setItemOptions] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [sessionOptions, setSessionOptions] = useState([]);
  const [cdcUsers, setCdcUsers] = useState([]);
  const [paidByOptions, setPaidByOptions] = useState([]);

  const currentDateDefault = useMemo(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
  }, []);

  const unpaidStatusId = useMemo(
    () =>
      (statusOptions.find((option) => String(option.label || "").trim().toLowerCase() === "unpaid")
        ?.value || ""),
    [statusOptions]
  );

  const loadMeta = useCallback(async () => {
    const data = await listCdcTeamExpenceMeta();
    setItemOptions(data.items || []);
    setStatusOptions(data.statuses || []);
    setSessionOptions(data.sessions || []);
    setCdcUsers(data.cdc_team_users || []);
    setPaidByOptions(data.paid_by_options || []);
  }, []);

  useEffect(() => {
    loadMeta().catch(() => {
      setItemOptions([]);
      setStatusOptions([]);
      setSessionOptions([]);
      setCdcUsers([]);
      setPaidByOptions([]);
    });
  }, [loadMeta]);

  const appendItem = async (name) => {
    const data = await addExpenseItemOption(name);
    await loadMeta();
    return data.id;
  };

  const appendStatus = async (name) => {
    const data = await addExpenseStatusOption(name);
    await loadMeta();
    return data.id;
  };

  const appendSession = async (name) => {
    const data = await addExpenseSessionOption(name);
    await loadMeta();
    return data.id;
  };

  const computeValues = useCallback((changedKey, changedValue, allValues) => {
    if (changedKey === "qty" || changedKey === "price") {
      const qty = Number.parseInt(changedKey === "qty" ? changedValue : allValues.qty, 10);
      const price = Number.parseInt(changedKey === "price" ? changedValue : allValues.price, 10);
      const safeQty = Number.isNaN(qty) || qty < 0 ? 0 : qty;
      const safePrice = Number.isNaN(price) || price < 0 ? 0 : price;
      return {
        qty: toNonNegativeInteger(changedKey === "qty" ? changedValue : allValues.qty),
        price: toNonNegativeInteger(changedKey === "price" ? changedValue : allValues.price),
        total_cost: String(safeQty * safePrice),
      };
    }
    return {};
  }, []);

  const fields = useMemo(
    () => [
      { key: "expense_date", label: "Expense Date", type: "date", default: currentDateDefault },
      {
        key: "item",
        label: "Item",
        options: itemOptions,
        onAppend: appendItem,
        required: true,
      },
      {
        key: "session",
        label: "Session",
        options: sessionOptions,
        onAppend: appendSession,
        required: true,
      },
      { key: "qty", label: "Qty", type: "number", default: "0" },
      { key: "price", label: "Price", type: "number", default: "0" },
      { key: "total_cost", label: "Total Cost", type: "number", readOnly: true, default: "0" },
      {
        key: "status",
        label: "Status",
        options: statusOptions,
        onAppend: appendStatus,
        required: true,
        default: unpaidStatusId,
      },
      { key: "paid_by", label: "Paid By", options: paidByOptions },
      { key: "settled_on", label: "Settled On", type: "date" },
      {
        key: "settled_by",
        label: "Settled By",
        options: cdcUsers,
      },
    ],
    [itemOptions, sessionOptions, statusOptions, cdcUsers, paidByOptions, currentDateDefault, unpaidStatusId]
  );

  const fetchFn = useCallback(async () => {
    const data = await listCdcTeamExpences();
    return data.expenses || [];
  }, []);

  const createFn = useCallback(async (payload) => {
    const data = await createCdcTeamExpence(payload);
    return data.expense;
  }, []);

  const updateFn = useCallback(async (id, payload) => {
    const data = await updateCdcTeamExpence(id, payload);
    return data.expense;
  }, []);

  const isPaidLocked = useCallback(
    (row) => !isAdmin && String(row?.status_label || "").trim().toLowerCase() === "paid",
    [isAdmin]
  );

  return (
    <CrudPage
      title="CDC Team Expence"
      columns={COLUMNS}
      fields={fields}
      fetchFn={fetchFn}
      createFn={createFn}
      updateFn={updateFn}
      deleteFn={deleteCdcTeamExpence}
      computeValues={computeValues}
      editDisabledPredicate={isPaidLocked}
      deleteDisabledPredicate={isPaidLocked}
      editDisabledTitle="Paid expense records can only be edited by admin users"
      deleteDisabledTitle="Paid expense records can only be deleted by admin users"
      tableWrapClassName="expense-table-wrap"
      stickyHeader
      tableMaxHeight="60vh"
    />
  );
}

export default CdcTeamExpencePage;


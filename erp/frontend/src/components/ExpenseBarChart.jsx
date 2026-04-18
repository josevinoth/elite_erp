import { useMemo, useState } from "react";
import { BarChartCard, useChartData, useChartFilters } from "./chartConfig";

const GROUP_OPTIONS = [
  { key: "item_label",    label: "By Item" },
  { key: "session_label", label: "By Session" },
  { key: "paid_by",       label: "By Paid By" },
  { key: "status_label",  label: "By Status" },
];

const FILTER_KEYS = [
  "expenseDateFrom", "expenseDateTo",
  "settledOnFrom",   "settledOnTo",
  "settledBy",
];

export default function ExpenseBarChart({ rows }) {
  const [groupBy, setGroupBy] = useState("item_label");
  const { values, onChange, onClear } = useChartFilters(FILTER_KEYS);

  const settledByOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    for (const r of rows || []) {
      const v = String(r.settled_by_label || "").trim();
      if (v && !seen.has(v)) { seen.add(v); opts.push(v); }
    }
    return opts.sort();
  }, [rows]);

  const filterDefs = [
    { type: "daterange", key: "expenseDate", label: "Expense Date" },
    { type: "daterange", key: "settledOn",   label: "Settled On" },
    { type: "select",    key: "settledBy",   label: "Settled By", options: settledByOptions },
  ];

  const filteredRows = useMemo(() => (rows || []).filter((r) => {
    const { expenseDateFrom, expenseDateTo, settledOnFrom, settledOnTo, settledBy } = values;
    if (expenseDateFrom && r.expense_date && r.expense_date < expenseDateFrom) return false;
    if (expenseDateTo   && r.expense_date && r.expense_date > expenseDateTo)   return false;
    if (settledOnFrom   && r.settled_on   && r.settled_on   < settledOnFrom)   return false;
    if (settledOnTo     && r.settled_on   && r.settled_on   > settledOnTo)     return false;
    if (settledBy && String(r.settled_by_label || "").trim() !== settledBy)    return false;
    return true;
  }), [rows, values]);

  const chartData = useChartData(filteredRows, groupBy, "total_cost");
  const totalAmount = chartData.reduce((s, d) => s + d.value, 0);

  if (!rows || rows.length === 0) return null;

  return (
    <BarChartCard
      title="Expense Summary"
      subtitle={
        <>
          Showing <strong>{filteredRows.length}</strong> of <strong>{rows.length}</strong> records
          &nbsp;·&nbsp; Total: <strong>{totalAmount.toLocaleString()}</strong>
        </>
      }
      groupOptions={GROUP_OPTIONS}
      groupBy={groupBy}
      onGroupChange={setGroupBy}
      filterDefs={filterDefs}
      filterValues={values}
      onFilterChange={onChange}
      onFilterClear={onClear}
      chartData={chartData}
      valueKey="value"
      formatVal={true}
      tooltipValueLabel="Total Cost"
    />
  );
}

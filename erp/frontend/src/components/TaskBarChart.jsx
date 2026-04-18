import { useMemo, useState } from "react";
import { BarChartCard, useChartData, useChartFilters } from "./chartConfig";

const GROUP_OPTIONS = [
  { key: "drawn_by",        label: "Drawn By" },
  { key: "approved_by",     label: "Approved By" },
  { key: "project_owner",   label: "Project Owner" },
  { key: "task_status",     label: "Status" },
  { key: "activity",        label: "Activity" },
  { key: "project_id_name", label: "Project" },
];

const FILTER_KEYS = [
  "startDateFrom",    "startDateTo",
  "endDateFrom",      "endDateTo",
  "approvedDateFrom", "approvedDateTo",
  "drawnBy",
  "approvedBy",
  "projectOwner",
  "status",
  "activity",
];

export default function TaskBarChart({ rows }) {
  const [groupBy, setGroupBy] = useState("drawn_by");
  const { values, onChange, onClear } = useChartFilters(FILTER_KEYS);

  // derive dropdown options from data
  const options = useMemo(() => {
    const sets = {
      drawnBy: new Set(), approvedBy: new Set(),
      projectOwner: new Set(), status: new Set(), activity: new Set(),
    };
    for (const r of rows || []) {
      if (r.drawn_by)        sets.drawnBy.add(String(r.drawn_by).trim());
      if (r.approved_by)     sets.approvedBy.add(String(r.approved_by).trim());
      if (r.project_owner)   sets.projectOwner.add(String(r.project_owner).trim());
      if (r.task_status)     sets.status.add(String(r.task_status).trim());
      if (r.activity)        sets.activity.add(String(r.activity).trim());
    }
    return Object.fromEntries(
      Object.entries(sets).map(([k, s]) => [k, [...s].filter(Boolean).sort()])
    );
  }, [rows]);

  const filterDefs = [
    { type: "daterange", key: "startDate",    label: "Start Date" },
    { type: "daterange", key: "endDate",      label: "End Date" },
    { type: "daterange", key: "approvedDate", label: "Approved Date" },
    { type: "select",    key: "drawnBy",      label: "Drawn By",       options: options.drawnBy },
    { type: "select",    key: "approvedBy",   label: "Approved By",    options: options.approvedBy },
    { type: "select",    key: "projectOwner", label: "Project Owner",  options: options.projectOwner },
    { type: "select",    key: "status",       label: "Status",         options: options.status },
    { type: "select",    key: "activity",     label: "Activity",       options: options.activity },
  ];

  const filteredRows = useMemo(() => (rows || []).filter((r) => {
    const {
      startDateFrom, startDateTo, endDateFrom, endDateTo,
      approvedDateFrom, approvedDateTo,
      drawnBy, approvedBy, projectOwner, status, activity,
    } = values;

    if (startDateFrom    && r.start_date    && r.start_date    < startDateFrom)    return false;
    if (startDateTo      && r.start_date    && r.start_date    > startDateTo)      return false;
    if (endDateFrom      && r.end_date      && r.end_date      < endDateFrom)      return false;
    if (endDateTo        && r.end_date      && r.end_date      > endDateTo)        return false;
    if (approvedDateFrom && r.approved_date && r.approved_date < approvedDateFrom) return false;
    if (approvedDateTo   && r.approved_date && r.approved_date > approvedDateTo)   return false;
    if (drawnBy      && String(r.drawn_by      || "").trim() !== drawnBy)      return false;
    if (approvedBy   && String(r.approved_by   || "").trim() !== approvedBy)   return false;
    if (projectOwner && String(r.project_owner || "").trim() !== projectOwner) return false;
    if (status       && String(r.task_status   || "").trim() !== status)       return false;
    if (activity     && String(r.activity      || "").trim() !== activity)     return false;
    return true;
  }), [rows, values]);

  const chartData = useChartData(filteredRows, groupBy);  // count-based

  if (!rows || rows.length === 0) return null;

  return (
    <BarChartCard
      title="Task Summary"
      subtitle={
        <>
          Showing <strong>{filteredRows.length}</strong> of <strong>{rows.length}</strong> tasks
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
      valueKey="count"
      formatVal={false}
      tooltipValueLabel="Tasks"
    />
  );
}


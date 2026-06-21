/**
 * chartConfig.jsx
 * Shared constants, utilities and sub-components for all bar charts in the app.
 * Import what you need:
 *   import { BAR_COLORS, formatAmount, ChartTooltip, GroupToggle, ChartFilters } from "./chartConfig";
 */

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ─── Colours ────────────────────────────────────────────
export const BAR_COLORS = [
  "#16b2a5", "#25d2c3", "#0e8a80", "#0b6b63",
  "#1dd1c3", "#11a89c", "#089287", "#06746b",
  "#04605a", "#034d48",
];

// ─── Amount formatter (axis labels + bar tops) ──────────
export const formatAmount = (v) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
};

// ─── Shared tooltip ─────────────────────────────────────
/**
 * @param {object} props
 * @param {boolean} props.active
 * @param {Array}   props.payload
 * @param {string}  [props.valueLabel]  label for the value row  (default "Count")
 * @param {string}  [props.valueKey]    payload key for value     (default "count")
 * @param {boolean} [props.formatValue] run formatAmount on value (default false)
 */
export function ChartTooltip({ active, payload, valueLabel = "Count", valueKey = "count", formatValue = false }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: "#ffffff", border: "1px solid #d9dce8",
      borderRadius: 8, padding: "10px 14px", color: "#495057", fontSize: "0.82rem",
    }}>
      <p style={{ margin: 0, fontWeight: 600, color: "#334155" }}>{d.name}</p>
      <p style={{ margin: "4px 0 0" }}>
        {valueLabel}: <strong>{formatValue ? formatAmount(d[valueKey]) : d[valueKey]?.toLocaleString()}</strong>
      </p>
      {valueKey !== "count" && d.count !== undefined && (
        <p style={{ margin: "2px 0 0" }}>Records: <strong>{d.count}</strong></p>
      )}
    </div>
  );
}

// ─── Group-by toggle buttons ─────────────────────────────
/**
 * @param {{ key: string, label: string }[]} options
 * @param {string}   value     current active key
 * @param {function} onChange  (key) => void
 */
export function GroupToggle({ options, value, onChange }) {
  return (
    <div className="expense-chart__group-btns">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          className={`expense-chart__group-btn${value === opt.key ? " expense-chart__group-btn--active" : ""}`}
          onClick={() => onChange(opt.key)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Generic date-range + dropdown filter bar ────────────
/**
 * @param {object[]} filterDefs  Array of filter definitions:
 *   { type: "daterange", key: string, label: string }
 *   { type: "select",    key: string, label: string, options: string[] }
 * @param {object}   values      { [key]: value }  for daterange: { [key+"From"]: "", [key+"To"]: "" }
 * @param {function} onChange    (key, value) => void
 * @param {function} onClear     () => void
 */
export function ChartFilters({ filterDefs, values, onChange, onClear }) {
  const hasActive = Object.values(values).some((v) => v !== "");
  return (
    <div className="expense-chart__filters">
      {filterDefs.map((f) => {
        if (f.type === "daterange") {
          return (
            <div key={f.key} className="expense-chart__filter-group">
              <label className="expense-chart__filter-label">{f.label}</label>
              <div className="expense-chart__filter-range">
                <input
                  type="date"
                  className="expense-chart__filter-input"
                  value={values[f.key + "From"] ?? ""}
                  onChange={(e) => onChange(f.key + "From", e.target.value)}
                  title={`${f.label} from`}
                />
                <span className="expense-chart__filter-sep">–</span>
                <input
                  type="date"
                  className="expense-chart__filter-input"
                  value={values[f.key + "To"] ?? ""}
                  onChange={(e) => onChange(f.key + "To", e.target.value)}
                  title={`${f.label} to`}
                />
              </div>
            </div>
          );
        }
        if (f.type === "select") {
          return (
            <div key={f.key} className="expense-chart__filter-group">
              <label className="expense-chart__filter-label">{f.label}</label>
              <select
                className="expense-chart__filter-select"
                value={values[f.key] ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
              >
                <option value="">All</option>
                {(f.options || []).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          );
        }
        return null;
      })}
      {hasActive && (
        <div className="expense-chart__filter-group expense-chart__filter-group--clear">
          <label className="expense-chart__filter-label">&nbsp;</label>
          <button type="button" className="expense-chart__clear-btn" onClick={onClear}>
            ✕ Clear
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Core recharts bar chart ─────────────────────────────
/**
 * @param {object[]} data         [{ name, value, count }]
 * @param {string}   [valueKey]   data key for bar height (default "count")
 * @param {boolean}  [formatVal]  format value labels with formatAmount
 * @param {string}   [tooltipValueLabel]
 */
export function CoreBarChart({ data, valueKey = "count", formatVal = false, tooltipValueLabel = "Count" }) {
  const angleLabels = data.length > 6;
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={data}
        margin={{ top: 24, right: 16, left: 8, bottom: angleLabels ? 80 : 40 }}
        barCategoryGap="30%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e6e9f2" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: "#6b7280", fontSize: 11 }}
          angle={angleLabels ? -35 : 0}
          textAnchor={angleLabels ? "end" : "middle"}
          interval={0}
          tickLine={false}
          axisLine={{ stroke: "#d9dce8" }}
        />
        <YAxis
          tickFormatter={formatVal ? formatAmount : undefined}
          tick={{ fill: "#6b7280", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={52}
          allowDecimals={false}
        />
        <Tooltip
          content={
            <ChartTooltip
              valueLabel={tooltipValueLabel}
              valueKey={valueKey}
              formatValue={formatVal}
            />
          }
          cursor={{ fill: "rgba(85,110,230,0.08)" }}
        />
        <Bar dataKey={valueKey} radius={[6, 6, 0, 0]} maxBarSize={64}>
          {data.map((entry, i) => (
            <Cell key={entry.name} fill={BAR_COLORS[i % BAR_COLORS.length]} />
          ))}
          <LabelList
            dataKey={valueKey}
            position="top"
            formatter={formatVal ? formatAmount : undefined}
            style={{ fill: "#334155", fontSize: 10, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Chart wrapper card ──────────────────────────────────
/**
 * Full chart card: header + optional filters + bar chart.
 *
 * @param {string}    title
 * @param {string}    subtitle          e.g. "Showing 12 of 45 records"
 * @param {object[]}  groupOptions      [{ key, label }]
 * @param {string}    groupBy
 * @param {function}  onGroupChange
 * @param {object[]}  filterDefs        passed to <ChartFilters>
 * @param {object}    filterValues
 * @param {function}  onFilterChange
 * @param {function}  onFilterClear
 * @param {object[]}  chartData         [{ name, count|value, count }]
 * @param {string}    [valueKey]
 * @param {boolean}   [formatVal]
 * @param {string}    [tooltipValueLabel]
 * @param {string}    [emptyMessage]
 */
export function BarChartCard({
  title,
  subtitle,
  groupOptions,
  groupBy,
  onGroupChange,
  filterDefs,
  filterValues,
  onFilterChange,
  onFilterClear,
  chartData,
  valueKey = "count",
  formatVal = false,
  tooltipValueLabel = "Count",
  emptyMessage = "No data matches the selected filters.",
}) {
  return (
    <div className="expense-chart-wrap">
      {/* Header */}
      <div className="expense-chart__header">
        <div>
          <h2 className="expense-chart__title">{title}</h2>
          {subtitle && <span className="expense-chart__total">{subtitle}</span>}
        </div>
        <GroupToggle options={groupOptions} value={groupBy} onChange={onGroupChange} />
      </div>

      {/* Filters */}
      {filterDefs?.length > 0 && (
        <ChartFilters
          filterDefs={filterDefs}
          values={filterValues}
          onChange={onFilterChange}
          onClear={onFilterClear}
        />
      )}

      {/* Chart or empty state */}
      {chartData.length === 0 ? (
        <p style={{ textAlign: "center", color: "#6b7280", padding: "2rem 0" }}>
          {emptyMessage}
        </p>
      ) : (
        <CoreBarChart
          data={chartData}
          valueKey={valueKey}
          formatVal={formatVal}
          tooltipValueLabel={tooltipValueLabel}
        />
      )}
    </div>
  );
}

// ─── Hook: useChartFilters ───────────────────────────────
/**
 * Generic filter state hook.
 * @param {string[]} keys   all filter state keys (e.g. ["expenseDateFrom", "expenseDateTo", "settledBy"])
 * @returns {{ values, onChange, onClear }}
 */
export function useChartFilters(keys) {
  const [values, setValues] = useState(() => Object.fromEntries(keys.map((k) => [k, ""])));
  const onChange = (key, val) => setValues((prev) => ({ ...prev, [key]: val }));
  const onClear  = () => setValues(Object.fromEntries(keys.map((k) => [k, ""])));
  return { values, onChange, onClear };
}

// ─── Hook: useChartData ──────────────────────────────────
/**
 * Groups rows by a key and aggregates a numeric field.
 * @param {object[]} rows
 * @param {string}   groupBy       row field to group on
 * @param {string}   [valueField]  row field to sum (if omitted → count only)
 * @returns {{ name, count, value }[]}  sorted desc by value/count
 */
export function useChartData(rows, groupBy, valueField = null) {
  return useMemo(() => {
    const grouped = {};
    for (const row of rows || []) {
      const key = String(row[groupBy] || "—").trim() || "—";
      if (!grouped[key]) grouped[key] = { name: key, count: 0, value: 0 };
      grouped[key].count += 1;
      if (valueField) grouped[key].value += Number(row[valueField]) || 0;
    }
    const arr = Object.values(grouped);
    return arr.sort((a, b) => (valueField ? b.value - a.value : b.count - a.count));
  }, [rows, groupBy, valueField]);
}


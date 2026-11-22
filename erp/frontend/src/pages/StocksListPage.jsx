import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BsBoxArrowUpRight } from "react-icons/bs";
import StandardListPage from "../components/StandardListPage";
import { listStockPurchases } from "../services/crudApi";
import StockPurchaseDetailsModal from "../components/StockPurchaseDetailsModal";
import StockGrnConsumedProjectsModal from "../components/StockGrnConsumedProjectsModal";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const TABLE_COLUMNS = [
  { key: "grn_number", label: "GRN Number", width: "110px", minWidth: "95px" },
  { key: "vendor", label: "Vendor", width: "140px", minWidth: "120px" },
  {
    key: "combined_item",
    label: "Item (Code _ Category _ Name)",
    width: "320px",
    minWidth: "280px",
  },
  { key: "purchased_qty", label: "Purchased Qty", align: "right", width: "85px", minWidth: "75px" },
  { key: "consumed_qty", label: "Consumed Qty", align: "right", width: "85px", minWidth: "75px" },
  { key: "balance_qty", label: "Balance Qty", align: "right", width: "80px", minWidth: "70px" },
  { key: "unit_price", label: "Unit Price", align: "right", width: "85px", minWidth: "75px" },
  { key: "total_price", label: "Total Price", align: "right", width: "95px", minWidth: "85px" },
  { key: "lce_cost", label: "LCE Cost", align: "right", width: "85px", minWidth: "75px" },
];

function StocksListPage() {
  const navigate = useNavigate();
  const [selectedPurchaseItem, setSelectedPurchaseItem] = useState(null);
  const [selectedConsumedItem, setSelectedConsumedItem] = useState(null);

  const fetchRows = useCallback(async () => {
    const data = await listStockPurchases();
    const purchases = Array.isArray(data?.stock_purchases) ? data.stock_purchases : [];

    const flattened = [];

    purchases.forEach((purchase) => {
      const items = Array.isArray(purchase?.items) ? purchase.items : [];
      items.forEach((item) => {
        const code = (item.item_code || "").trim();
        const cat = (item.item_category || "").trim();
        const name = (item.item_name || "").trim();
        const combined = [code, cat, name].filter(Boolean).join(" _ ") || "—";

        flattened.push({
          key: `${purchase.id}-${item.id || item.item_code || item.item_name}`,
          purchase_id: purchase.id,
          purchase_item_id: item.id,
          item_code_id: item.item_code_id || item.item_master_id || "",
          grn_number: item.grn_number || "-",
          vendor: purchase.vendor_name || "",
          item_category: cat,
          item_name: name,
          item_code: code,
          combined_item: combined,
          purchased_qty: item.purchase_qty || item.quantity || "0",
          consumed_qty: item.consumed_qty || "0",
          balance_qty: item.balance_qty || (item.purchase_qty || item.quantity || "0"),
          unit_price: item.unit_price || "0",
          total_price: item.total_price || "0",
          lce_cost: item.lce_cost || "0",
          updated_at: purchase.updated_at || "",
          updated_on: purchase.updated_on || purchase.updated_at || "",
          updated_by: purchase.updated_by || "",
        });
      });
    });

    return flattened;
  }, []);

  const columns = useMemo(() => TABLE_COLUMNS.map((column) => {
    if (column.key === "combined_item") {
      return {
        ...column,
        render: (row) => (
          <span style={{ fontWeight: 600, color: "#0f172a" }}>
            {row.combined_item || [row.item_code, row.item_category, row.item_name].filter(Boolean).join(" _ ") || "—"}
          </span>
        ),
      };
    }
    if (column.key === "purchased_qty" || column.key === "consumed_qty") {
      const isPurchased = column.key === "purchased_qty";
      return {
        ...column,
        align: "right",
        render: (row) => (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (isPurchased) setSelectedPurchaseItem(row);
              else setSelectedConsumedItem(row);
            }}
            title={isPurchased
              ? `View purchase details for ${row.item_code || row.combined_item}`
              : `View projects consuming ${row.grn_number}`}
            style={{
              background: isPurchased ? "#e0f2fe" : "#fef3c7",
              color: isPurchased ? "#0369a1" : "#b45309",
              border: `1px solid ${isPurchased ? "#7dd3fc" : "#fcd34d"}`,
              borderRadius: "6px",
              padding: "2px 8px",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: "0.82rem",
            }}
          >
            {row[column.key]}
          </button>
        ),
      };
    }
    return column;
  }), []);

  const rowActions = useMemo(
    () => [
      {
        key: "open-stock-purchase",
        label: "Open Purchase",
        ariaLabel: "Open Purchase",
        title: "Open Purchase",
        className: "users-action--edit",
        icon: BsBoxArrowUpRight,
        disabled: (row) => !row.purchase_id,
        onClick: (row) => navigate(`/stock-purchase/record/${row.purchase_id}`),
      },
    ],
    [navigate]
  );

  const renderHeaderActions = useCallback(
    () => (
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" className="crud-add-btn" onClick={() => navigate("/items-to-order")}>
          Items to Order
        </button>
        <button type="button" className="crud-add-btn" onClick={() => navigate("/stock-purchase")}>
          Received Goods
        </button>
      </div>
    ),
    [navigate]
  );

  return (
    <>
    <StandardListPage
      title="Stocks List"
      columns={columns}
      fetchRows={fetchRows}
      rowKey="key"
      rowActions={rowActions}
      renderHeaderActions={renderHeaderActions}
      exportFileName="Stocks List"
      includeAuditColumns={true}
      showDefaultEdit={false}
      showDefaultDelete={false}
      defaultPageSize={20}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
      tableMaxHeight="62vh"
      tableWrapClassName="users-table-wrap--stocks-list"
    />
    {selectedPurchaseItem && (
      <StockPurchaseDetailsModal
        item={selectedPurchaseItem}
        onClose={() => setSelectedPurchaseItem(null)}
      />
    )}
    {selectedConsumedItem && (
      <StockGrnConsumedProjectsModal
        item={selectedConsumedItem}
        onClose={() => setSelectedConsumedItem(null)}
      />
    )}
    </>
  );
}

export default StocksListPage;

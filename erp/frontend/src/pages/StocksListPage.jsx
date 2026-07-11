import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BsBoxArrowUpRight } from "react-icons/bs";
import StandardListPage from "../components/StandardListPage";
import { listStockPurchases } from "../services/crudApi";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const TABLE_COLUMNS = [
  { key: "grn_number", label: "GRN Number" },
  { key: "item_category", label: "Item Category" },
  { key: "item_name", label: "Item Name" },
  { key: "item_code", label: "Item Code" },
  { key: "quantity", label: "Qty Purchased" },
  { key: "unit_price", label: "Unit Price" },
  { key: "total_price", label: "Total Price" },
  { key: "lce_cost", label: "LCE Cost" },
];

function StocksListPage() {
  const navigate = useNavigate();

  const fetchRows = useCallback(async () => {
    const data = await listStockPurchases();
    const purchases = Array.isArray(data?.stock_purchases) ? data.stock_purchases : [];
    const flattened = [];

    purchases.forEach((purchase) => {
      const items = Array.isArray(purchase?.items) ? purchase.items : [];
      items.forEach((item) => {
        flattened.push({
          key: `${purchase.id}-${item.id || item.item_code || item.item_name}`,
          purchase_id: purchase.id,
          grn_number: item.grn_number || "",
          item_category: item.item_category || "",
          item_name: item.item_name || "",
          item_code: item.item_code || "",
          quantity: item.quantity || "0",
          unit_price: item.unit_price || "0",
          total_price: item.total_price || "0",
          lce_cost: item.lce_cost || "0",
        });
      });
    });

    return flattened;
  }, []);

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
      <button type="button" className="crud-add-btn" onClick={() => navigate("/stock-purchase")}>
        Stock Purchase
      </button>
    ),
    [navigate]
  );

  return (
    <StandardListPage
      title="Stocks List"
      columns={TABLE_COLUMNS}
      fetchRows={fetchRows}
      rowKey="key"
      rowActions={rowActions}
      renderHeaderActions={renderHeaderActions}
      exportFileName="Stocks List"
      includeAuditColumns={false}
      showDefaultEdit={false}
      showDefaultDelete={false}
      defaultPageSize={20}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
      tableMaxHeight="62vh"
    />
  );
}

export default StocksListPage;

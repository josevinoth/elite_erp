import { useCallback } from "react";
import StandardListPage from "../components/StandardListPage";
import { deleteItemCosting, listItemCosting } from "../services/ItemCostingServiceAPI.js";

const TABLE_COLUMNS = [
  { key: "project_ref", label: "Project Ref" },
  { key: "item_code", label: "Item Code" },
  { key: "item_description", label: "Description" },
  { key: "cost_max", label: "Max Cost" },
  { key: "cost_min", label: "Min Cost" },
  { key: "cost", label: "User Cost" },
  { key: "qty", label: "Qty" },
  { key: "total_price", label: "Total Price" },
  { key: "uom", label: "UOM" },
];

async function fetchAllItemCostingRows() {
  const pageSize = 200;
  const firstPage = await listItemCosting(1, pageSize);
  const firstItems = Array.isArray(firstPage?.items) ? firstPage.items : [];
  const totalCount = Number(firstPage?.count || 0);

  if (totalCount <= firstItems.length) {
    return firstItems;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const allRows = [...firstItems];

  for (let page = 2; page <= totalPages; page += 1) {
    const data = await listItemCosting(page, pageSize);
    const rows = Array.isArray(data?.items) ? data.items : [];
    allRows.push(...rows);
  }

  return allRows;
}

function ItemsCostingListPage() {
  const fetchRows = useCallback(async () => fetchAllItemCostingRows(), []);

  return (
    <StandardListPage
      title="Item Costing List"
      columns={TABLE_COLUMNS}
      fetchRows={fetchRows}
      deleteFn={deleteItemCosting}
      showAddButton
      addButtonTo="/item-costing/add"
      editButtonTo={(row) => `/item-costing/${row.id}`}
      showDefaultEdit
      showDefaultDelete
      includeAuditColumns={false}
      exportFileName="Item Costing List"
      defaultPageSize={20}
      pageSizeOptions={[10, 20, 50, 100]}
      tableMaxHeight="62vh"
      deleteConfirmFn={() => "Delete this Item Costing record?"}
    />
  );
}

export default ItemsCostingListPage;
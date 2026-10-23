export const homeNavItems = [
  {
    label: "Users Management",
    to: "/users-management",
    icon: "users",
    adminOnly: true,
    children: [
      {
        label: "User Registration",
        to: "/register",
        icon: "userRegistration",
        adminOnly: true,
      },
      {
        label: "Pending Approvals",
        to: "/pending-approvals",
        icon: "pendingApprovals",
        badgeKey: "pendingCount",
        adminOnly: true,
      },
    ],
  },
  {
    label: "Projects",
    to: "/projects",
    icon: "projects",
    disableParentNavigation: true,
    children: [
      {
        label: "Projects List",
        to: "/projects",
        icon: "projectsList",
      },
      {
        label: "Layout Drawing Approval",
        to: "/projects/layout-drawing-approval",
        icon: "layoutDrawingApproval",
      },
      {
        label: "Quotation",
        to: "/projects/quotation",
        icon: "quotation",
      },
      {
        label: "Stock Planning",
        to: "/stock-planning",
        icon: "stockPlanning",
      },
      {
        label: "Item Costing",
        to: "/item-costing",
        icon: "itemCosting",
      },
      {
        label: "Project Costing",
        to: "/projects/project-costing",
        icon: "projectCosting",
      },
    ],
  },
  { label: "LCE", to: "/projects/costing", icon: "lce", superAdminOnly: true },
  { label: "Vendors", to: "/vendors", icon: "vendors" },
  { label: "Orders", to: "/orders", icon: "orders" },
  {
    label: "Stocks:",
    to: "/stocks",
    icon: "stocks",
    disableParentNavigation: true,
    children: [
      {
        label: "Stocks List",
        to: "/stocks",
        icon: "stocksList",
      },
      {
        label: "Stock Purchase",
        to: "/stock-purchase",
        icon: "stockPurchase",
        superAdminOnly: true,
      },
      {
        label: "Place Stock Order",
        to: "/stock-purchase/place-order",
        icon: "placeStockOrder",
      },
      {
        label: "Stock Maintenance",
        to: "/stock-maintenance",
        icon: "stockMaintenance",
      },
      {
        label: "Stock Manufacture",
        to: "/stock-manufacture",
        icon: "stockManufacture",
      },
      {
        label: "Stock Retrieval",
        to: "/stock-retrieval",
        icon: "stockRetrieval",
      },
      {
        label: "Stock Acceptance",
        to: "/stock-acceptance",
        icon: "stockAcceptance",
      },
      {
        label: "Stock Return",
        to: "/stock-return",
        icon: "stockReturn",
      },
      {
        label: "Item Master",
        to: "/stock-items",
        icon: "itemMaster",
      },
      {
        label: "Item Code",
        to: "/stock-item-code-names",
        icon: "itemCodeNames",
      },
    ],
  },
  {
    label: "CDC Team Expence",
    to: "/cdc-team-expence",
    icon: "cdcExpense",
    cdcOnly: true,
  },
  { label: "Task", to: "/task", icon: "task" },
  { label: "Timesheet", to: "/timesheet", icon: "timesheet" },
  { label: "CutSheet Optimiser", to: "/cut-sheet-optimiser", icon: "cutSheet" },
];

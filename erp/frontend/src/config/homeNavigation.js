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
        icon: "projects",
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
        label: "Item Costing",
        to: "/item-costing",
        icon: "itemMaster",
      },
    ],
  },
  { label: "LCE", to: "/projects/costing", icon: "costing" },
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
        icon: "stocks",
      },
      {
        label: "Stock Purchase",
        to: "/stock-purchase",
        icon: "stockPurchase",
      },
      {
        label: "Stock Maintenance",
        to: "/stock-maintenance",
        icon: "stockMaintenance",
      },
      {
        label: "Stock Manufacture",
        to: "/stock-manufacture",
        icon: "itemMaster",
      },
      {
        label: "Item Master",
        to: "/stock-items",
        icon: "itemMaster",
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

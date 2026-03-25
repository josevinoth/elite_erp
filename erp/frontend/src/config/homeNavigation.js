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
    children: [
      {
        label: "Requirements",
        to: "/projects/requirements",
        icon: "requirements",
      },
      {
        label: "Quotation",
        to: "/projects/quotation",
        icon: "quotation",
      },
      {
        label: "Customer PO",
        to: "/projects/customer-po",
        icon: "customerPo",
      },
      {
        label: "Costing",
        to: "/projects/costing",
        icon: "costing",
      },
    ],
  },
  { label: "Vendors", to: "/vendors", icon: "vendors" },
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
  { label: "Task", to: "/task", icon: "task" },
];

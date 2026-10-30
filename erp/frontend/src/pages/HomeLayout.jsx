import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BsBarChartFill,
  BsBell,
  BsBoxSeam,
  BsBoxArrowUpRight,
  BsBuildingFill,
  BsCalculatorFill,
  BsClipboardData,
  BsFolder2Open,
  BsHourglassSplit,
  BsKanbanFill,
  BsPeopleFill,
  BsPersonPlusFill,
  BsPerson,
  BsCartCheck,
  BsReceiptCutoff,
  BsScissors,
} from "react-icons/bs";
import HomeSideNav from "../components/HomeSideNav";
import { listPendingRegistrations } from "../services/authApi";
import { listLayoutDrawingApprovals, listStockPlanningItems, listItemsToOrder } from "../services/crudApi";

function HomeLayout({ currentUser }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [layoutApprovalCount, setLayoutApprovalCount] = useState(0);
  const [stockPlanningCount, setStockPlanningCount] = useState(0);
  const [itemsToOrderCount, setItemsToOrderCount] = useState(0);
  const roleName = String(currentUser?.role || "").toLowerCase();
  const teamName = String(currentUser?.team || "").toLowerCase();
  const isAdmin = roleName === "admin" || roleName === "super admin" || roleName === "staff";
  const isSuperAdmin = Boolean(currentUser?.is_superuser) || roleName === "super admin";
  const isCdcTeam = teamName === "cdc team";

  useEffect(() => {
    listLayoutDrawingApprovals()
      .then((data) => {
        setLayoutApprovalCount(Array.isArray(data.records) ? data.records.length : 0);
      })
      .catch(() => {
        setLayoutApprovalCount(0);
      });
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setPendingCount(0);
      return;
    }

    listPendingRegistrations()
      .then((data) => setPendingCount(data.count || 0))
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    listStockPlanningItems()
      .then((data) => {
        setStockPlanningCount(Array.isArray(data.items) ? data.items.length : 0);
      })
      .catch(() => {
        setStockPlanningCount(0);
      });
  }, []);

  useEffect(() => {
    listItemsToOrder()
      .then((data) => {
        setItemsToOrderCount(Array.isArray(data.items) ? data.items.length : 0);
      })
      .catch(() => {
        setItemsToOrderCount(0);
      });
  }, []);

  const dashboardCards = [
    ...(isAdmin
      ? [
          {
            title: "User Registration",
            stat: "Create new user accounts",
            to: "/register",
            icon: BsPersonPlusFill,
            theme: "indigo",
          },
          {
            title: "Users",
            stat: pendingCount > 0 ? `${pendingCount} pending approval` : "Manage accounts",
            to: "/users-management",
            icon: BsPeopleFill,
            badge: pendingCount,
            theme: "blue",
          },
        ]
      : []),
    { title: "Projects", stat: "Track active work", to: "/projects", icon: BsFolder2Open, theme: "sky" },
    {
      title: "Layout Drawing Approval",
      stat: layoutApprovalCount > 0 ? `${layoutApprovalCount} awaiting your action` : "No pending approvals",
      to: "/projects/layout-drawing-approval",
      icon: BsClipboardData,
      badge: layoutApprovalCount,
      theme: "violet",
    },
    {
      title: "Item Costing",
      stat: "Costing records and totals",
      to: "/item-costing",
      icon: BsBarChartFill,
      theme: "teal",
    },
    {
      title: "Stock Planning",
      stat: stockPlanningCount > 0 ? `${stockPlanningCount} items to plan` : "No pending planning items",
      to: "/stock-planning",
      icon: BsKanbanFill,
      badge: stockPlanningCount,
      theme: "amber",
    },
    { title: "Vendors", stat: "Supplier directory", to: "/vendors", icon: BsBuildingFill, theme: "rose" },
    ...(isSuperAdmin || isAdmin
      ? [
          {
            title: "Landing Cost Estimate (LCE)",
            stat: "Landing cost estimate records",
            to: "/projects/costing",
            icon: BsCalculatorFill,
            theme: "emerald",
          },
          {
            title: "Landing Cost Actuals (LCA)",
            stat: "Landing cost actuals records",
            to: "/projects/lca",
            icon: BsReceiptCutoff,
            theme: "cyan",
          },
        ]
      : []),
    { title: "Orders", stat: "Project Orders", to: "/stocks", icon: BsBoxArrowUpRight, theme: "purple" },
    { title: "Stocks", stat: "Purchase and maintenance", to: "/stocks", icon: BsBarChartFill, theme: "emerald" },
    {
      title: "Items to Order",
      stat: itemsToOrderCount > 0 ? `${itemsToOrderCount} items to order` : "No pending items to order",
      to: "/items-to-order",
      icon: BsCartCheck,
      badge: itemsToOrderCount,
      theme: "orange",
    },
    { title: "Stock Manufacture", stat: "In-house manufactured items", to: "/stock-manufacture", icon: BsBoxSeam, theme: "royal" },
    ...(isAdmin || isCdcTeam
      ? [
          {
            title: "CDC Team Expence",
            stat: "Track CDC team expenses",
            to: "/cdc-team-expence",
            icon: BsBell,
            theme: "burntOrange",
          },
        ]
      : []),
    { title: "Tasks", stat: "Execution board", to: "/task", icon: BsPerson, theme: "slate" },
    {
      title: "Cut Optimiser",
      stat: "Estimate required panel sheets",
      to: "/projects/cut-optimiser",
      icon: BsScissors,
      theme: "pink",
    },
    {
      title: "Timesheet",
      stat: isAdmin ? "Track billed efforts" : "Only admins can access",
      to: "/timesheet",
      icon: BsHourglassSplit,
      disabled: !isAdmin,
      theme: "indigo",
    },
  ];

  return (
    <section className="home-layout">
      <HomeSideNav badges={{ pendingCount }} isAdmin={isAdmin} isCdcTeam={isCdcTeam} isSuperAdmin={isSuperAdmin} />
      <main className="home-main">
        <div className="dashboard-grid">
          {dashboardCards.map((card) => {
            const cardBody = (
              <>
                <div className={`dashboard-card__icon-box dashboard-card__icon-box--${card.theme || "blue"}`}>
                  <card.icon className="dashboard-card__icon" aria-hidden="true" />
                </div>
                <div className="dashboard-card__body">
                  <div className="dashboard-card__head">
                    <strong className="dashboard-card__title">{card.title}</strong>
                    {card.badge > 0 ? (
                      <span className="dashboard-card__badge">
                        {card.badge}
                      </span>
                    ) : null}
                  </div>
                  <span className="dashboard-card__stat">{card.stat}</span>
                </div>
              </>
            );

            if (card.disabled) {
              return (
                <div
                  className={`dashboard-card dashboard-card--disabled dashboard-card--${card.theme || "blue"}`}
                  key={card.title}
                  role="link"
                  aria-disabled="true"
                  title="Only admins can access"
                >
                  {cardBody}
                </div>
              );
            }

            return (
              <Link
                className={`dashboard-card dashboard-card--${card.theme || "blue"}`}
                key={card.title}
                to={card.to}
              >
                {cardBody}
              </Link>
            );
          })}
        </div>
      </main>
    </section>
  );
}

export default HomeLayout;


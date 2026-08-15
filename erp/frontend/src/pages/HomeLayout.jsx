import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BsBarChartFill,
  BsBoxSeam,
  BsBuildingFill,
  BsCashCoin,
  BsFileEarmarkTextFill,
  BsFolder2Open,
  BsHourglassSplit,
  BsKanbanFill,
  BsListTask,
  BsPeopleFill,
  BsPersonPlusFill,
} from "react-icons/bs";
import HomeSideNav from "../components/HomeSideNav";
import { listPendingRegistrations } from "../services/authApi";
import { listLayoutDrawingApprovals, listQuotationSummaries } from "../services/crudApi";

function HomeLayout({ currentUser }) {
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const [layoutApprovalCount, setLayoutApprovalCount] = useState(0);
  const [quotationRows, setQuotationRows] = useState([]);
  const roleName = String(currentUser?.role || "").toLowerCase();
  const teamName = String(currentUser?.team || "").toLowerCase();
  const isAdmin = roleName === "admin" || roleName === "super admin" || roleName === "staff";
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
    listQuotationSummaries()
      .then((data) => {
        setQuotationRows(Array.isArray(data.quotations) ? data.quotations.slice(0, 8) : []);
      })
      .catch(() => {
        setQuotationRows([]);
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
          },
          {
            title: "Users",
            stat: pendingCount > 0 ? `${pendingCount} pending approval` : "Manage accounts",
            to: "/users-management",
            icon: BsPeopleFill,
            badge: pendingCount,
          },
        ]
      : []),
    { title: "Projects", stat: "Track active work", to: "/projects", icon: BsFolder2Open },
    {
      title: "Layout Drawing Approval",
      stat: layoutApprovalCount > 0 ? `${layoutApprovalCount} awaiting your action` : "No pending approvals",
      to: "/projects/layout-drawing-approval",
      icon: BsFileEarmarkTextFill,
      badge: layoutApprovalCount,
    },
    {
      title: "Item Costing",
      stat: "Costing records and totals",
      to: "/item-costing",
      icon: BsBoxSeam,
    },
    { title: "Vendors", stat: "Supplier directory", to: "/vendors", icon: BsBuildingFill },
    { title: "Orders", stat: "Project Orders", to: "/stocks", icon: BsBarChartFill },
    { title: "Stocks", stat: "Purchase and maintenance", to: "/stocks", icon: BsBarChartFill },
    { title: "Stock Manufacture", stat: "In-house manufactured items", to: "/stock-manufacture", icon: BsBoxSeam },
    ...(isAdmin || isCdcTeam
      ? [
          {
            title: "CDC Team Expence",
            stat: "Track CDC team expenses",
            to: "/cdc-team-expence",
            icon: BsCashCoin,
          },
        ]
      : []),
    { title: "Tasks", stat: "Execution board", to: "/task", icon: BsListTask },
    {
      title: "Cut Optimiser",
      stat: "Estimate required panel sheets",
      to: "/projects/cut-optimiser",
      icon: BsKanbanFill,
    },
    {
      title: "Timesheet",
      stat: isAdmin ? "Track billed efforts" : "Only admins can access",
      to: "/timesheet",
      icon: BsHourglassSplit,
      disabled: !isAdmin,
    },
  ];

  return (
    <section className="home-layout">
      <HomeSideNav badges={{ pendingCount }} isAdmin={isAdmin} isCdcTeam={isCdcTeam} />
      <main className="home-main">
        <section className="dashboard-panel">
          <h1 className="module-page__title">Dashboard</h1>
          <p className="module-page__description">
            Home space is reserved for dashboards. Open modules from the side navigator.
          </p>

          <div className="dashboard-grid">
            {dashboardCards.map((card) => {
              const cardBody = (
                <>
                  <div className="dashboard-card__head">
                    <card.icon className="dashboard-card__icon" aria-hidden="true" />
                    <strong>{card.title}</strong>
                    {card.badge > 0 ? (
                      <span className="pending-badge" style={{ marginLeft: "0.4rem" }}>
                        {card.badge}
                      </span>
                    ) : null}
                  </div>
                  <span>{card.stat}</span>
                </>
              );

              if (card.disabled) {
                return (
                  <div
                    className="dashboard-card dashboard-card--disabled"
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
                <Link className="dashboard-card" key={card.title} to={card.to}>
                  {cardBody}
                </Link>
              );
            })}
          </div>

          <div style={{ marginTop: "1.2rem", background: "#fff", border: "1px solid #d9dee8", borderRadius: "10px", padding: "0.9rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
              <h2 style={{ margin: 0, fontSize: "1rem", color: "#0f172a" }}>Quotation List</h2>
              <Link to="/projects/quotation" className="crud-add-btn" style={{ textDecoration: "none" }}>View All</Link>
            </div>
            <div className="users-table-wrap" style={{ overflowX: "auto" }}>
              <table className="users-table" style={{ tableLayout: "auto", width: "100%" }}>
                <thead>
                  <tr>
                    <th>Quotation Number</th>
                    <th>Project ID</th>
                    <th>Project Name</th>
                    <th>Total Quotation Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {quotationRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", color: "#64748b" }}>No quotations found.</td>
                    </tr>
                  ) : quotationRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => navigate(`/projects/quotation?quotationId=${row.id}`)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>{row.quotation_number || "Auto"}</td>
                      <td>{row.project_code || row.project_id}</td>
                      <td>{row.project_name || "-"}</td>
                      <td style={{ textAlign: "right" }}>{row.total_quotation_cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </section>
  );
}

export default HomeLayout;


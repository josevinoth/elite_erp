import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BsBarChartFill,
  BsBuildingFill,
  BsFolder2Open,
  BsListTask,
  BsPeopleFill,
  BsPersonPlusFill,
} from "react-icons/bs";
import HomeSideNav from "../components/HomeSideNav";
import { listPendingRegistrations } from "../services/authApi";

function HomeLayout({ currentUser }) {
  const [pendingCount, setPendingCount] = useState(0);
  const roleName = String(currentUser?.role || "").toLowerCase();
  const isAdmin = roleName === "admin" || roleName === "super admin" || roleName === "staff";

  useEffect(() => {
    if (!isAdmin) {
      setPendingCount(0);
      return;
    }

    listPendingRegistrations()
      .then((data) => setPendingCount(data.count || 0))
      .catch(() => {});
  }, [isAdmin]);

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
    { title: "Vendors", stat: "Supplier directory", to: "/vendors", icon: BsBuildingFill },
    { title: "Stock", stat: "Purchase and maintenance", to: "/stock-purchase", icon: BsBarChartFill },
    { title: "Tasks", stat: "Execution board", to: "/task", icon: BsListTask },
    { title: "Import Tasks", stat: "Upload Excel to Tasks", to: "/task?import=excel", icon: BsListTask },
  ];

  return (
    <section className="home-layout">
      <HomeSideNav badges={{ pendingCount }} isAdmin={isAdmin} />
      <main className="home-main">
        <section className="dashboard-panel">
          <h1 className="module-page__title">Dashboard</h1>
          <p className="module-page__description">
            Home space is reserved for dashboards. Open modules from the side navigator.
          </p>

          <div className="dashboard-grid">
            {dashboardCards.map((card) => (
              <Link className="dashboard-card" key={card.title} to={card.to}>
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
              </Link>
            ))}
          </div>
        </section>
      </main>
    </section>
  );
}

export default HomeLayout;


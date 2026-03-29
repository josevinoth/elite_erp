import { NavLink } from "react-router-dom";
import {
  BsBoxes,
  BsBuildingFill,
  BsCashCoin,
  BsCartCheckFill,
  BsClipboardData,
  BsFileEarmarkTextFill,
  BsFolder2Open,
  BsHourglassSplit,
  BsKanbanFill,
  BsListTask,
  BsPersonCheck,
  BsPersonPlusFill,
  BsPeopleFill,
  BsReceiptCutoff,
} from "react-icons/bs";
import { homeNavItems } from "../config/homeNavigation";

const iconMap = {
  users: BsPeopleFill,
  projects: BsFolder2Open,
  vendors: BsBuildingFill,
  stockPurchase: BsCartCheckFill,
  stockMaintenance: BsBoxes,
  cdcExpense: BsCashCoin,
  task: BsListTask,
  timesheet: BsHourglassSplit,
  requirements: BsClipboardData,
  quotation: BsFileEarmarkTextFill,
  customerPo: BsReceiptCutoff,
  costing: BsCashCoin,
  pendingApprovals: BsPersonCheck,
  userRegistration: BsPersonPlusFill,
};

function NavIcon({ icon }) {
  const IconComponent = iconMap[icon] || BsKanbanFill;
  return <IconComponent className={`home-sidenav__icon home-sidenav__icon--${icon}`} aria-hidden="true" />;
}

function HomeSideNav({ badges = {}, isAdmin = false, isCdcTeam = false }) {
  const visibleItems = homeNavItems
    .filter((item) => (!item.adminOnly || isAdmin) && (!item.cdcOnly || isAdmin || isCdcTeam))
    .map((item) => ({
      ...item,
      disabled: !isAdmin && item.to === "/timesheet",
      children: item.children?.filter(
        (child) => (!child.adminOnly || isAdmin) && (!child.cdcOnly || isAdmin || isCdcTeam)
      ),
    }));

  return (
    <aside className="home-sidenav" aria-label="Main navigation">
      <h2 className="home-sidenav__title">Modules</h2>

      <nav className="home-sidenav__nav">
        {visibleItems.map((item) => {
          const itemBadge = item.badgeKey && badges[item.badgeKey] > 0
            ? badges[item.badgeKey]
            : null;

          return (
            <div className="home-sidenav__group" key={item.label}>
              {item.disabled ? (
                <div
                  className="home-sidenav__link home-sidenav__link--disabled"
                  role="link"
                  aria-disabled="true"
                  title="Only admins can access"
                >
                  <NavIcon icon={item.icon} />
                  <span className="home-sidenav__label">{item.label}</span>
                  {itemBadge ? (
                    <span className="pending-badge pending-badge--nav">{itemBadge}</span>
                  ) : null}
                </div>
              ) : (
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `home-sidenav__link${isActive ? " home-sidenav__link--active" : ""}`
                  }
                >
                  <NavIcon icon={item.icon} />
                  <span className="home-sidenav__label">{item.label}</span>
                  {itemBadge ? (
                    <span className="pending-badge pending-badge--nav">{itemBadge}</span>
                  ) : null}
                </NavLink>
              )}

              {item.children ? (
                <div className="home-sidenav__children">
                  {item.children.map((subItem) => {
                    const subBadge = subItem.badgeKey && badges[subItem.badgeKey] > 0
                      ? badges[subItem.badgeKey]
                      : null;

                    return (
                      <NavLink
                        key={subItem.label}
                        to={subItem.to}
                        className={({ isActive }) =>
                          `home-sidenav__sublink${isActive ? " home-sidenav__sublink--active" : ""}`
                        }
                      >
                        <NavIcon icon={subItem.icon} />
                        <span className="home-sidenav__label">{subItem.label}</span>
                        {subBadge ? (
                          <span className="pending-badge pending-badge--nav">{subBadge}</span>
                        ) : null}
                      </NavLink>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

export default HomeSideNav;


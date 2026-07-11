import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BsBoxSeam,
  BsBoxes,
  BsBuildingFill,
  BsCashCoin,
  BsCartCheckFill,
  BsChevronDown,
  BsChevronRight,
  BsClipboardData,
  BsFileEarmarkTextFill,
  BsFolder2Open,
  BsHourglassSplit,
  BsKanbanFill,
  BsListTask,
  BsPeopleFill,
  BsPersonCheck,
  BsPersonPlusFill,
  BsReceiptCutoff,
} from "react-icons/bs";
import { homeNavItems } from "../config/homeNavigation";

const iconMap = {
  users: BsPeopleFill,
  projects: BsFolder2Open,
  vendors: BsBuildingFill,
  stocks: BsBoxes,
  stockPurchase: BsCartCheckFill,
  stockMaintenance: BsBoxes,
  itemMaster: BsBoxSeam,
  cdcExpense: BsCashCoin,
  task: BsListTask,
  timesheet: BsHourglassSplit,
  requirements: BsClipboardData,
  quotation: BsFileEarmarkTextFill,
  customerPo: BsReceiptCutoff,
  costing: BsCashCoin,
  cutOptimiser: BsKanbanFill,
  layoutDrawingApproval: BsFileEarmarkTextFill,
  pendingApprovals: BsPersonCheck,
  userRegistration: BsPersonPlusFill,
};

function NavIcon({ icon }) {
  const IconComponent = iconMap[icon] || BsKanbanFill;
  return <IconComponent className={`home-sidenav__icon home-sidenav__icon--${icon}`} aria-hidden="true" />;
}

function pathMatches(targetPath, currentPathname) {
  if (!targetPath) return false;
  if (currentPathname === targetPath) return true;
  return currentPathname.startsWith(`${targetPath}/`);
}

function HomeSideNav({ badges = {}, isAdmin = false, isCdcTeam = false }) {
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState({});

  const visibleItems = useMemo(
    () =>
      homeNavItems
        .filter((item) => (!item.adminOnly || isAdmin) && (!item.cdcOnly || isAdmin || isCdcTeam))
        .map((item) => ({
          ...item,
          disabled: !isAdmin && item.to === "/timesheet",
          children: item.children?.filter(
            (child) => (!child.adminOnly || isAdmin) && (!child.cdcOnly || isAdmin || isCdcTeam)
          ),
        })),
    [isAdmin, isCdcTeam]
  );

  useEffect(() => {
    setExpandedGroups((prev) => {
      const next = { ...prev };
      visibleItems.forEach((item) => {
        if (!item.children?.length) return;
        const hasActiveChild = item.children.some((child) => pathMatches(child.to, location.pathname));
        if (hasActiveChild) {
          next[item.label] = true;
        }
      });
      return next;
    });
  }, [location.pathname, visibleItems]);

  const toggleGroup = (label) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside className="home-sidenav" aria-label="Main navigation">
      <nav className="home-sidenav__nav">
        {visibleItems.map((item) => {
          const itemBadge = item.badgeKey && badges[item.badgeKey] > 0
            ? badges[item.badgeKey]
            : null;
          const hasChildren = Array.isArray(item.children) && item.children.length > 0;
          const isExpanded = !!expandedGroups[item.label];

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
              ) : hasChildren && item.disableParentNavigation ? (
                <button
                  type="button"
                  className={`home-sidenav__link home-sidenav__toggle${isExpanded ? " home-sidenav__toggle--expanded" : ""}`}
                  onClick={() => toggleGroup(item.label)}
                  aria-expanded={isExpanded}
                  aria-controls={`nav-group-${item.icon || item.label}`}
                >
                  <NavIcon icon={item.icon} />
                  <span className="home-sidenav__label">{item.label}</span>
                  {itemBadge ? (
                    <span className="pending-badge pending-badge--nav">{itemBadge}</span>
                  ) : null}
                  <span className="home-sidenav__toggle-icon" aria-hidden="true">
                    {isExpanded ? <BsChevronDown /> : <BsChevronRight />}
                  </span>
                </button>
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

              {item.children && (!item.disableParentNavigation || isExpanded) ? (
                <div className="home-sidenav__children" id={`nav-group-${item.icon || item.label}`}>
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


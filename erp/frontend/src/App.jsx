import { useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import ProjectHeader from "./components/ProjectHeader";
import CdcTeamExpencePage from "./pages/CdcTeamExpencePage";
import HomeLayout from "./pages/HomeLayout";
import LoginPage from "./pages/LoginPage";
import ModulePage from "./pages/ModulePage";
import PendingApprovalsPage from "./pages/PendingApprovalsPage";
import ProjectsPage from "./pages/ProjectsPage";
import RegisterPage from "./pages/RegisterPage";
import StockMaintenancePage from "./pages/StockMaintenancePage";
import StockPurchasePage from "./pages/StockPurchasePage";
import TaskPage from "./pages/TaskPage";
import TimesheetPage from "./pages/TimesheetPage";
import UsersManagementPage from "./pages/UsersManagementPage";
import VendorsPage from "./pages/VendorsPage";
import { logoutUser } from "./services/authApi";
import { clearSessionUser, getSessionUser } from "./services/sessionUser";

function App() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(() => getSessionUser());
  const roleName = String(currentUser?.role || "").toLowerCase();
  const teamName = String(currentUser?.team || "").toLowerCase();
  const isAdmin = roleName === "admin" || roleName === "super admin" || roleName === "staff";
  const isCdcTeam = teamName === "cdc team";

  const displayUsername = currentUser?.username || "Guest";
  const displayRole = currentUser?.role || (currentUser ? "User" : "Visitor");

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (_error) {
      // Keep UI responsive even if the logout API fails.
    } finally {
      clearSessionUser();
      setCurrentUser(null);
      navigate("/login", { replace: true });
    }
  };

  const homePath = currentUser ? "/home" : "/login";
  const secureRoute = (element) => (currentUser ? element : <Navigate to="/login" replace />);
  const adminRoute = (element) =>
    currentUser ? (isAdmin ? element : <Navigate to="/home" replace />) : <Navigate to="/login" replace />;
  const cdcTeamRoute = (element) =>
    currentUser
      ? (isAdmin || isCdcTeam ? element : <Navigate to="/home" replace />)
      : <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      <ProjectHeader
        title="EliteOne"
        homeTo={homePath}
        username={displayUsername}
        role={displayRole}
        onLogout={handleLogout}
      />

      <div className="app-content">
        <Routes>
          <Route path="/" element={<Navigate to={homePath} replace />} />
          <Route path="/login" element={<LoginPage onLoginSuccess={setCurrentUser} />} />
          <Route
            path="/register"
            element={currentUser && !isAdmin ? <Navigate to="/home" replace /> : <RegisterPage />}
          />

          <Route path="/home" element={secureRoute(<HomeLayout currentUser={currentUser} />)} />

          <Route path="/users-management" element={adminRoute(<UsersManagementPage />)} />
          <Route path="/pending-approvals" element={adminRoute(<PendingApprovalsPage />)} />
          <Route path="/projects" element={secureRoute(<ProjectsPage />)} />
          <Route path="/vendors" element={secureRoute(<VendorsPage />)} />
          <Route path="/stock-purchase" element={secureRoute(<StockPurchasePage />)} />
          <Route path="/stock-maintenance" element={secureRoute(<StockMaintenancePage />)} />
          <Route path="/cdc-team-expence" element={cdcTeamRoute(<CdcTeamExpencePage />)} />
          <Route path="/task" element={secureRoute(<TaskPage />)} />
          <Route path="/timesheet" element={secureRoute(<TimesheetPage />)} />

          <Route
            path="/projects/requirements"
            element={
              secureRoute(
                <ModulePage
                  title="Requirements"
                  description="Capture and track customer requirements for each project."
                />
              )
            }
          />
          <Route
            path="/projects/quotation"
            element={
              secureRoute(
                <ModulePage
                  title="Quotation"
                  description="Create and manage project quotations before order confirmation."
                />
              )
            }
          />
          <Route
            path="/projects/customer-po"
            element={
              secureRoute(
                <ModulePage
                  title="Customer PO"
                  description="Maintain customer purchase orders and associated project references."
                />
              )
            }
          />
          <Route
            path="/projects/costing"
            element={
              secureRoute(
                <ModulePage
                  title="Costing"
                  description="Track estimated and actual project costing details."
                />
              )
            }
          />

          <Route path="*" element={<Navigate to={homePath} replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;


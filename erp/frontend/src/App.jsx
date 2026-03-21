import { useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import ProjectHeader from "./components/ProjectHeader";
import HomeLayout from "./pages/HomeLayout";
import LoginPage from "./pages/LoginPage";
import ModulePage from "./pages/ModulePage";
import PendingApprovalsPage from "./pages/PendingApprovalsPage";
import ProjectsPage from "./pages/ProjectsPage";
import RegisterPage from "./pages/RegisterPage";
import StockMaintenancePage from "./pages/StockMaintenancePage";
import StockPurchasePage from "./pages/StockPurchasePage";
import TaskPage from "./pages/TaskPage";
import UsersManagementPage from "./pages/UsersManagementPage";
import VendorsPage from "./pages/VendorsPage";
import { logoutUser } from "./services/authApi";
import { clearSessionUser, getSessionUser } from "./services/sessionUser";

function App() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(() => getSessionUser());

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
          <Route path="/register" element={<RegisterPage />} />

          <Route path="/home" element={secureRoute(<HomeLayout />)} />

          <Route path="/users-management" element={secureRoute(<UsersManagementPage />)} />
          <Route path="/pending-approvals" element={secureRoute(<PendingApprovalsPage />)} />
          <Route path="/projects" element={secureRoute(<ProjectsPage />)} />
          <Route path="/vendors" element={secureRoute(<VendorsPage />)} />
          <Route path="/stock-purchase" element={secureRoute(<StockPurchasePage />)} />
          <Route path="/stock-maintenance" element={secureRoute(<StockMaintenancePage />)} />
          <Route path="/task" element={secureRoute(<TaskPage />)} />

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


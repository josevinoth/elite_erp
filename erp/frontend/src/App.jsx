import {useCallback, useEffect, useState} from "react";
import {Navigate, Route, Routes, useNavigate} from "react-router-dom";
import ProjectHeader from "./components/ProjectHeader";
import ErrorBoundary from "./components/ErrorBoundary";
import CdcTeamExpencePage from "./pages/CdcTeamExpencePage";
import CutOptimiserListPage from "./pages/CutOptimiserListPage";
import CostingPage from "./pages/CostingPage";
import HomeLayout from "./pages/HomeLayout";
import LceListPage from "./pages/LceListPage";
import LayoutDrawingApprovalPage from "./pages/LayoutDrawingApprovalPage";
import ItemCostingFormPage from "./pages/ItemCostingFormPage";
import ItemCostingListPage from "./pages/ItemCostingListPage";
import LoginPage from "./pages/LoginPage";
import ModulePage from "./pages/ModulePage";
import PendingApprovalsPage from "./pages/PendingApprovalsPage";
import ProjectsAddPage from "./pages/ProjectsAddPage";
import ProjectsPage from "./pages/ProjectsPage";
import RegisterPage from "./pages/RegisterPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import StockItemsPage from "./pages/StockItemsPage";
import StockManufacturePage from "./pages/StockManufacturePage.jsx";
import StockMaintenancePage from "./pages/StockMaintenancePage";
import StockPurchaseAddPage from "./pages/StockPurchaseAddPage.jsx";
import StockPurchaseItemTracePage from "./pages/StockPurchaseItemTracePage.jsx";
import StockPurchasePage from "./pages/StockPurchasePage";
import StocksListPage from "./pages/StocksListPage";
import TaskPage from "./pages/TaskPage";
import TimesheetPage from "./pages/TimesheetPage";
import UsersManagementPage from "./pages/UsersManagementPage";
import VendorsPage from "./pages/VendorsPage";
import {logoutUser} from "./services/authApi";
import {listHeaderNotifications} from "./services/crudApi";
import {clearSessionUser, getSessionUser} from "./services/sessionUser";
import CutSheetOptimiser from "./pages/CutSheetOptimiser";

function App() {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState(() => getSessionUser());
    const roleName = String(currentUser?.role || "").toLowerCase();
    const teamName = String(currentUser?.team || "").toLowerCase();
    const isAdmin = roleName === "admin" || roleName === "super admin" || roleName === "staff";
    const isCdcTeam = teamName === "cdc team";

    const displayUsername = currentUser?.username || "Guest";
    const displayRole = currentUser?.role || (currentUser ? "User" : "Visitor");

    const [taskAlerts, setTaskAlerts] = useState({count: 0, items: []});
    const [messageAlerts, setMessageAlerts] = useState({count: 0, items: []});
    const [layoutDrawingAlerts, setLayoutDrawingAlerts] = useState({count: 0, items: []});
    const [notificationRefreshToken, setNotificationRefreshToken] = useState(0);

    const triggerNotificationRefresh = useCallback(() => {
        setNotificationRefreshToken((prev) => prev + 1);
    }, []);

    useEffect(() => {
        if (!currentUser) {
            setTaskAlerts({count: 0, items: []});
            setMessageAlerts({count: 0, items: []});
            setLayoutDrawingAlerts({count: 0, items: []});
            return;
        }

        let alive = true;
        const refreshAlerts = async () => {
            try {
                const data = await listHeaderNotifications();
                if (!alive) return;
                setTaskAlerts(data.task_alerts || {count: 0, items: []});
                setMessageAlerts(data.message_alerts || {count: 0, items: []});
                setLayoutDrawingAlerts(data.layout_drawing_alerts || {count: 0, items: []});
            } catch (_error) {
                if (!alive) return;
                setTaskAlerts({count: 0, items: []});
                setMessageAlerts({count: 0, items: []});
                setLayoutDrawingAlerts({count: 0, items: []});
            }
        };

        refreshAlerts();
        const timerId = window.setInterval(refreshAlerts, 30000);
        return () => {
            alive = false;
            window.clearInterval(timerId);
        };
    }, [currentUser, notificationRefreshToken]);

    const handleLogout = async () => {
        try {
            await logoutUser();
        } catch (_error) {
            // Keep UI responsive even if the logout API fails.
        } finally {
            clearSessionUser();
            setCurrentUser(null);
            navigate("/login", {replace: true});
        }
    };

    const homePath = currentUser ? "/home" : "/login";
    const secureRoute = (element) => (currentUser ? element : <Navigate to="/login" replace/>);
    const adminRoute = (element) =>
        currentUser ? (isAdmin ? element : <Navigate to="/home" replace/>) : <Navigate to="/login" replace/>;
    const cdcTeamRoute = (element) =>
        currentUser
            ? (isAdmin || isCdcTeam ? element : <Navigate to="/home" replace/>)
            : <Navigate to="/login" replace/>;

    return (
        <div className="app-shell">
            <ProjectHeader
                title="EliteOne"
                homeTo={homePath}
                username={displayUsername}
                role={displayRole}
                onLogout={handleLogout}
                taskAlerts={taskAlerts}
                messageAlerts={messageAlerts}
                layoutDrawingAlerts={layoutDrawingAlerts}
            />

            <div className="app-content">
                <ErrorBoundary>
                    <Routes>
                        <Route path="/" element={<Navigate to={homePath} replace/>}/>
                        <Route path="/login" element={<LoginPage onLoginSuccess={setCurrentUser}/>}/>
                        <Route path="/reset-password" element={<ResetPasswordPage/>}/>
                        <Route
                            path="/register"
                            element={currentUser && !isAdmin ? <Navigate to="/home" replace/> : <RegisterPage/>}
                        />

                        <Route path="/home" element={secureRoute(<HomeLayout currentUser={currentUser}/>)}/>
                        <Route path="/users-management" element={adminRoute(<UsersManagementPage/>)}/>
                        <Route path="/pending-approvals" element={adminRoute(<PendingApprovalsPage/>)}/>
                        <Route path="/projects" element={secureRoute(<ProjectsPage/>)}/>
                        <Route path="/projects/add" element={secureRoute(<ProjectsAddPage/>)}/>
                        <Route path="/projects/record/:projectId" element={secureRoute(<ProjectsAddPage/>)}/>
                        <Route path="/projects/layout-drawing-approval" element={secureRoute(<LayoutDrawingApprovalPage/>)}/>
                        <Route path="/item-costing" element={secureRoute(<ItemCostingListPage/>)}/>
                        <Route path="/item-costing/add" element={secureRoute(<ItemCostingFormPage/>)}/>
                        <Route path="/item-costing/:id" element={secureRoute(<ItemCostingFormPage/>)}/>
                        <Route path="/projects/cut-optimiser" element={secureRoute(<CutOptimiserListPage/>)}/>
                        <Route path="/projects/cut-optimiser/add" element={secureRoute(<CutSheetOptimiser/>)}/>
                        <Route path="/projects/cut-optimiser/record/:recordId"
                               element={secureRoute(<CutSheetOptimiser/>)}/>
                        <Route path="/vendors" element={secureRoute(<VendorsPage/>)}/>
                        <Route path="/stock-purchase" element={secureRoute(<StockPurchasePage/>)}/>
                        <Route path="/stock-purchase/add" element={secureRoute(<StockPurchaseAddPage/>)}/>
                        <Route path="/stock-purchase/record/:purchaseId"
                               element={secureRoute(<StockPurchaseAddPage/>)}/>
                        <Route path="/stock-purchase/item-trace/:itemId"
                               element={secureRoute(<StockPurchaseItemTracePage/>)}/>
                        <Route path="/stocks" element={secureRoute(<StocksListPage/>)}/>
                        <Route path="/stock-maintenance" element={secureRoute(<StockMaintenancePage/>)}/>
                        <Route path="/stock-items" element={secureRoute(<StockItemsPage/>)}/>
                        <Route path="/stock-manufacture" element={secureRoute(<StockManufacturePage/>)}/>
                        <Route path="/cdc-team-expence" element={cdcTeamRoute(<CdcTeamExpencePage/>)}/>
                        <Route path="/task"
                               element={secureRoute(<TaskPage onNotificationsChanged={triggerNotificationRefresh}/>)}/>
                        <Route path="/timesheet" element={secureRoute(<TimesheetPage/>)}/>

                        <Route path="/projects/requirements" element={secureRoute(<ModulePage title="Requirements"
                                                                                              description="Capture and track customer requirements for each project."/>)
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
                                secureRoute(<LceListPage/>)
                            }
                        />
                        <Route
                            path="/projects/costing/add"
                            element={
                                secureRoute(<CostingPage/>)
                            }
                        />
                        <Route
                            path="/projects/costing/record/:lceId"
                            element={
                                secureRoute(<CostingPage/>)
                            }
                        />
                        <Route path="/projects/cutsheet-optimiser" element={secureRoute(<CutSheetOptimiser/>)}/>
                        <Route path="/cut-sheet-optimiser" element={secureRoute(<CutSheetOptimiser/>)}/>

                        <Route path="*" element={<Navigate to={homePath} replace/>}/>
                    </Routes>
                </ErrorBoundary>
            </div>
        </div>
    );
}

export default App;


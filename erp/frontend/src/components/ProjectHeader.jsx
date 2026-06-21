import {Link, useNavigate} from "react-router-dom";
import eliteLogo from "../assets/logos/elite_logo.png";
import {BellIcon, HomeIcon, LogoutIcon, MessageIcon} from "./AppIcons";

function ProjectHeader({
                           title = "EliteOne",
                           homeTo = "/",
                           username = "Guest",
                           role = "Visitor",
                           onLogout,
                           taskAlerts = {count: 0, items: []},
                           messageAlerts = {count: 0, items: []},
                       }) {
    const navigate = useNavigate();

    const openTaskAlertList = () => {
        navigate("/task?alert=tasks");
    };

    const openMessageAlertList = () => {
        navigate("/task?alert=messages");
    };

    return (
        <header className="project-header">
            <div className="project-header__left">
                <Link className=" project-header__home" to={homeTo}>
                    <HomeIcon className="app-icon"/>
                    <span> Home</span>
                </Link>
            </div>

            {/*Logo and title are disabled*/}
            <strong className="project-header__title">
                <img className="project-header__logo" src={eliteLogo} alt="EliteOne logo"/>
                <span>{title}</span>
            </strong>

            <div className="project-header__right">
                <div className="project-header__alerts">
                    <button
                        type="button"
                        className="project-header__alert-btn"
                        onClick={openTaskAlertList}
                        title="View new tasks"
                    >
                        <BellIcon className="app-icon"/>
                        {taskAlerts.count > 0 ?
                            <span className="project-header__alert-badge">{taskAlerts.count}</span> : null}
                    </button>
                </div>

                <div className="project-header__alerts">
                    <button
                        type="button"
                        className="project-header__alert-btn"
                        onClick={openMessageAlertList}
                        title="View new task messages"
                    >
                        <MessageIcon className="app-icon"/>
                        {messageAlerts.count > 0 ?
                            <span className="project-header__alert-badge">{messageAlerts.count}</span> : null}
                    </button>
                </div>

                <div className="project-header__identity">
                    <span className="project-header__username">{username}</span>
                    <span className="project-header__role">{role}</span>
                </div>
                <button className="project-header__logout" onClick={onLogout}>
                    <LogoutIcon className="app-icon"/>
                    <span> Logout</span>
                </button>

            </div>
        </header>
    );
}

export default ProjectHeader;


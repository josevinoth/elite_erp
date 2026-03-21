import { Link } from "react-router-dom";
import eliteLogo from "../assets/logos/elite_logo.png";
import { HomeIcon, LogoutIcon } from "./AppIcons";

function ProjectHeader({
  title = "EliteOne",
  homeTo = "/",
  username = "Guest",
  role = "Visitor",
  onLogout,
}) {
  return (
    <header className="project-header">
      <div className="project-header__left">
        <Link className="project-header__home" to={homeTo}>
          <HomeIcon className="app-icon" />
          <span>Home</span>
        </Link>
      </div>

      <strong className="project-header__title">
        <img className="project-header__logo" src={eliteLogo} alt="EliteOne logo" />
        <span>{title}</span>
      </strong>

      <div className="project-header__right">
        <div className="project-header__identity">
          <span className="project-header__username">{username}</span>
          <span className="project-header__role">{role}</span>
        </div>
        <button type="button" className="project-header__logout" onClick={onLogout}>
          <LogoutIcon className="app-icon" />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}

export default ProjectHeader;


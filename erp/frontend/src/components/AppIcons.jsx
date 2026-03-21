import { BsBoxArrowRight, BsHouseDoor, BsLock, BsPerson, BsPersonBadge, BsToggleOn } from "react-icons/bs";

export function HomeIcon({ className = "app-icon" }) {
  return <BsHouseDoor className={className} aria-hidden="true" focusable="false" />;
}

export function LogoutIcon({ className = "app-icon" }) {
  return <BsBoxArrowRight className={className} aria-hidden="true" focusable="false" />;
}

export function UserIcon({ className = "app-icon" }) {
  return <BsPerson className={className} aria-hidden="true" focusable="false" />;
}

export function LockIcon({ className = "app-icon" }) {
  return <BsLock className={className} aria-hidden="true" focusable="false" />;
}

export function RoleIcon({ className = "app-icon" }) {
  return <BsPersonBadge className={className} aria-hidden="true" focusable="false" />;
}

export function StatusIcon({ className = "app-icon" }) {
  return <BsToggleOn className={className} aria-hidden="true" focusable="false" />;
}


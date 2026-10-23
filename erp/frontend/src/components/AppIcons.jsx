import {
  BsBell,
  BsBoxArrowRight,
  BsChatDots,
  BsHouseDoor,
  BsLock,
  BsPeople,
  BsPerson,
  BsPersonBadge,
  BsToggleOn,
  BsEye,
  BsEyeSlash,   // 👁️ open/closed eye icons
} from "react-icons/bs";

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

export function TeamIcon({ className = "app-icon" }) {
  return <BsPeople className={className} aria-hidden="true" focusable="false" />;
}

export function BellIcon({ className = "app-icon" }) {
  return <BsBell className={className} aria-hidden="true" focusable="false" />;
}

export function MessageIcon({ className = "app-icon" }) {
  return <BsChatDots className={className} aria-hidden="true" focusable="false" />;
}
/* 👁️ Eye icons for password toggle */
export function EyeIcon({ className = "app-icon" }) {
  return <BsEye className={className} aria-hidden="true" focusable="false" />;
}

export function EyeOffIcon({ className = "app-icon" }) {
  return <BsEyeSlash className={className} aria-hidden="true" focusable="false" />;
}


import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/auth_common.css";

const configuredBase =
  import.meta.env.BASE_URL === "/"
    ? ""
    : import.meta.env.BASE_URL.replace(/\/$/, "");
const currentPath = window.location.pathname;
const routerBase =
  configuredBase &&
  (currentPath === configuredBase || currentPath.startsWith(`${configuredBase}/`))
    ? configuredBase
    : undefined;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBase}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);


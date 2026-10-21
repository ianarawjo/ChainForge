import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/geist-mono";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { ContextMenuProvider } from "mantine-contextmenu";
import { AlertModalProvider } from "./AlertModal";
import ColorThemeProvider from "./ColorThemeProvider";
import { installBackendAuth } from "./backend/sessionToken";
import { installOfflineGuard, setHostChecker } from "./backend/offlineMode";
import { APP_IS_RUNNING_LOCALLY, call_flask_backend } from "./backend/utils";

// Before anything talks to the server: requests to it must carry the session
// token, or it refuses them. See backend/sessionToken.ts.
installBackendAuth();
// And in offline mode, requests off the local network are refused. See backend/offlineMode.ts.
installOfflineGuard(window);
// Names (e.g. "labserver") are looked up by ChainForge's server, which can
if (APP_IS_RUNNING_LOCALLY())
  setHostChecker((host) =>
    call_flask_backend("isLocalHost", { host }).then((r) => r?.local === true),
  );

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ColorThemeProvider>
      <AlertModalProvider>
        <ContextMenuProvider>
          <App />
        </ContextMenuProvider>
      </AlertModalProvider>
    </ColorThemeProvider>
  </React.StrictMode>,
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

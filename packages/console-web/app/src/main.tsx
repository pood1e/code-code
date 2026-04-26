import React from "react";
import ReactDOM from "react-dom/client";
import { SWRConfig } from "swr";
import "@code-code/console-web-ui/tokens.css";
import "./styles.css";
import { App } from "./app";
import { initializeConsoleWebTelemetry } from "./telemetry/runtime";

initializeConsoleWebTelemetry();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SWRConfig value={{ keepPreviousData: true, errorRetryCount: 3 }}>
      <App />
    </SWRConfig>
  </React.StrictMode>
);

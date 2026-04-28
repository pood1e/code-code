import React from "react";
import ReactDOM from "react-dom/client";
import { SWRConfig } from "swr";
import "@radix-ui/themes/styles.css";
import "@code-code/console-web-ui/tokens.css";
import "@console-app/styles.css";
import { LLM_PROVIDER_SECTIONS, LLM_PROVIDER_ROUTES } from "@code-code/console-web-provider";
import { App } from "@console-app/app";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SWRConfig value={{ keepPreviousData: true, errorRetryCount: 3 }}>
      <App
        sections={LLM_PROVIDER_SECTIONS}
        routes={LLM_PROVIDER_ROUTES}
        brand="Code Code Showcase"
        defaultRoute="/providers"
      />
    </SWRConfig>
  </React.StrictMode>,
);

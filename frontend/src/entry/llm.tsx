import { createRoot } from "react-dom/client";

import "../index.css";
import AppShell from "@shared/app";
import sharedRoutes from "@shared/routes";
import llmRoutes from "@llm/routes";

createRoot(document.getElementById("root")!).render(
  <AppShell>
    {sharedRoutes()}
    {llmRoutes()}
  </AppShell>,
);

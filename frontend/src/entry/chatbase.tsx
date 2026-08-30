import { createRoot } from "react-dom/client";

import "../index.css";
import AppShell from "@shared/app";
import sharedRoutes from "@shared/routes";
import chatbaseRoutes from "@chatbase/routes";
import adminRoutes from "@admin/routes";

createRoot(document.getElementById("root")!).render(
  <AppShell>
    {sharedRoutes()}
    {chatbaseRoutes()}
    {adminRoutes()}
  </AppShell>,
);

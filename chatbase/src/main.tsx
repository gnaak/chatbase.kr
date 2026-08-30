import { createRoot } from "react-dom/client";

import "./index.css";
import AppShell from "@/app";
import chatbaseRoutes from "@/routes";
import adminRoutes from "@/admin/routes";

createRoot(document.getElementById("root")!).render(
  <AppShell>
    {chatbaseRoutes()}
    {adminRoutes()}
  </AppShell>,
);

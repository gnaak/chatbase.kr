import { createRoot } from "react-dom/client";

import "./index.css";
import AppShell from "@/app";
import chatbaseRoutes from "@/routes";
import adminRoutes from "@/admin/routes";
import { captureUtm } from "@/hooks/common/utm";

/**
 * 렌더보다 먼저 부른다. 라우팅이 시작되면 주소가 바뀔 수 있고, 그러면 첫
 * 진입에 붙어 있던 utm_* 을 놓친다.
 */
captureUtm();

createRoot(document.getElementById("root")!).render(
  <AppShell>
    {chatbaseRoutes()}
    {adminRoutes()}
  </AppShell>,
);

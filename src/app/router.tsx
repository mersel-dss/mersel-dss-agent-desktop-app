/**
 * Uygulama yönlendirmesi. Masaüstü ortamı için HashRouter kullanılır.
 */

import { createHashRouter } from "react-router-dom";
import { AppShell } from "@/presentation/layout/AppShell";
import { DashboardPage } from "@/presentation/pages/DashboardPage";
import { SignPage } from "@/presentation/pages/SignPage";
import { VirtualCardsPage } from "@/presentation/pages/VirtualCardsPage";
import { VerifyPage } from "@/presentation/pages/VerifyPage";
import { TimestampPage } from "@/presentation/pages/TimestampPage";
import { DiagnosticsPage } from "@/presentation/pages/DiagnosticsPage";
import { ChangelogPage } from "@/presentation/pages/ChangelogPage";
import { SettingsPage } from "@/presentation/pages/SettingsPage";

export const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "sign", element: <SignPage /> },
      { path: "virtual-cards", element: <VirtualCardsPage /> },
      { path: "verify", element: <VerifyPage /> },
      { path: "timestamp", element: <TimestampPage /> },
      { path: "diagnostics", element: <DiagnosticsPage /> },
      { path: "changelog", element: <ChangelogPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);

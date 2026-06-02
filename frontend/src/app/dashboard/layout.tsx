import { type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { AppProvider } from "./AppContext";
import { CreateWorkspaceModal } from "./CreateWorkspaceModal";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <div className="grid h-screen grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="hidden border-r border-gray-800 bg-gray-900/50 lg:block">
          <Sidebar />
        </aside>
        <main className="overflow-y-auto">{children}</main>
      </div>
      <CreateWorkspaceModal />
    </AppProvider>
  );
}

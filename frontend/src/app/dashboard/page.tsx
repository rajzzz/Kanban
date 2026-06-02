import DashboardClient from "./DashboardClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — Kanban",
  description: "Your workspaces and projects at a glance.",
};



export default function DashboardPage() {
  return <DashboardClient />;
}


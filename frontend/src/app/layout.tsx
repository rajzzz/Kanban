import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kanban — Multi-Tenant Task Management",
  description:
    "Collaborate across workspaces with projects, tasks, and real-time role-based access control.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

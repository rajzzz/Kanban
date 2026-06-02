import type { Metadata } from "next";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Dashboard — Kanban",
  description: "Your workspaces and projects at a glance.",
};

/**
 * Server Component — receives x-user-id injected by middleware.
 * The full workspace/project data loading will be added as the
 * frontend grows; this shell confirms auth is wired end-to-end.
 */
export default async function DashboardPage() {
  const headersList = await headers();
  const userId = headersList.get("x-user-id") ?? "unknown";

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        padding: "2rem",
        color: "var(--text-primary)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.5rem",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "3rem",
            height: "3rem",
            borderRadius: "0.75rem",
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "0.5rem",
          }}
          aria-hidden="true"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="18" rx="1" />
            <rect x="14" y="3" width="7" height="10" rx="1" />
            <rect x="14" y="17" width="7" height="4" rx="1" />
          </svg>
        </div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>
          Dashboard
        </h1>
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>
          Session active · user{" "}
          <code
            style={{
              fontFamily: "monospace",
              fontSize: "0.8125rem",
              background: "var(--bg-elevated)",
              padding: "0.1em 0.4em",
              borderRadius: "0.25rem",
              color: "var(--brand-400)",
            }}
          >
            {userId}
          </code>
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
          Workspace and project views coming next.
        </p>
      </div>
    </main>
  );
}

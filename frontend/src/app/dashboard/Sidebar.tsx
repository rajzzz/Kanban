"use client";

import { useAppState, useAppDispatch } from "./AppContext";

// --- SVG Icons ---
function WorkspaceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2.5 opacity-70">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function Sidebar() {
  const { organizations, workspaces, selectedOrganizationId, selectedWorkspaceId } = useAppState();
  const dispatch = useAppDispatch();

  const handleOrgChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch({ type: "SET_SELECTED_ORGANIZATION", payload: e.target.value });
  };

  const handleWorkspaceSelect = (workspaceId: string) => {
    dispatch({ type: "SET_SELECTED_WORKSPACE", payload: workspaceId });
  };

  const activeOrg = organizations.find((o) => o.id === selectedOrganizationId);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "rgba(13, 16, 23, 0.75)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRight: "1px solid var(--border-default)",
        padding: "1.5rem",
        color: "var(--text-primary)",
      }}
    >
      {/* Brand logo header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "2rem" }}>
        <div
          style={{
            width: "2.25rem",
            height: "2.25rem",
            borderRadius: "0.5rem",
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="18" rx="1" />
            <rect x="14" y="3" width="7" height="10" rx="1" />
            <rect x="14" y="17" width="7" height="4" rx="1" />
          </svg>
        </div>
        <span style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.025em" }}>
          Kanban Flow
        </span>
      </div>

      {/* Organization Switcher */}
      <div style={{ marginBottom: "1.75rem" }}>
        <label
          htmlFor="org-switcher"
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Organization
        </label>
        <div style={{ position: "relative", marginTop: "0.375rem" }}>
          <select
            id="org-switcher"
            value={selectedOrganizationId ?? ""}
            onChange={handleOrgChange}
            style={{
              width: "100%",
              borderRadius: "0.5rem",
              border: "1px solid var(--border-default)",
              background: "var(--bg-elevated)",
              padding: "0.625rem 1rem",
              fontSize: "0.9375rem",
              fontWeight: 500,
              color: "var(--text-primary)",
              cursor: "pointer",
              outline: "none",
              appearance: "none",
            }}
          >
            {organizations.length === 0 ? (
              <option value="" disabled>No Organizations</option>
            ) : (
              organizations.map((org) => (
                <option key={org.id} value={org.id} style={{ background: "var(--bg-dark)" }}>
                  {org.name}
                </option>
              ))
            )}
          </select>
          <div
            style={{
              position: "absolute",
              right: "1rem",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: "var(--text-muted)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </div>

      {/* Workspaces Section */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Workspaces
          </span>
          <button
            onClick={() => dispatch({ type: "OPEN_CREATE_WORKSPACE_MODAL" })}
            title="Create Workspace"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--brand-400)",
              display: "flex",
              alignItems: "center",
              padding: "0.25rem",
              borderRadius: "0.25rem",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--brand-300)";
              e.currentTarget.style.background = "var(--bg-elevated)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--brand-400)";
              e.currentTarget.style.background = "none";
            }}
          >
            <PlusIcon />
          </button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, marginRight: "-0.5rem", paddingRight: "0.5rem" }}>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {workspaces.length === 0 ? (
              <li style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "var(--text-muted)", fontStyle: "italic", textAlign: "center" }}>
                No workspaces created yet.
              </li>
            ) : (
              workspaces.map((ws) => {
                const isActive = selectedWorkspaceId === ws.id;
                return (
                  <li key={ws.id}>
                    <button
                      onClick={() => handleWorkspaceSelect(ws.id)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        display: "flex",
                        alignItems: "center",
                        padding: "0.625rem 0.75rem",
                        borderRadius: "0.5rem",
                        background: isActive ? "var(--bg-elevated)" : "none",
                        border: isActive ? "1px solid rgba(99,102,241,0.25)" : "1px solid transparent",
                        cursor: "pointer",
                        color: isActive ? "var(--brand-400)" : "var(--text-secondary)",
                        fontWeight: isActive ? 600 : 500,
                        fontSize: "0.9375rem",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                          e.currentTarget.style.color = "var(--text-primary)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = "none";
                          e.currentTarget.style.color = "var(--text-secondary)";
                        }
                      }}
                    >
                      <WorkspaceIcon />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                        {ws.name}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>

      {/* User / Session footer */}
      {activeOrg && (
        <div
          style={{
            marginTop: "auto",
            paddingTop: "1rem",
            borderTop: "1px solid var(--border-default)",
            display: "flex",
            flexDirection: "column",
            gap: "0.375rem",
          }}
        >
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
            Active Org
          </span>
          <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {activeOrg.name}
          </span>
        </div>
      )}
    </div>
  );
}

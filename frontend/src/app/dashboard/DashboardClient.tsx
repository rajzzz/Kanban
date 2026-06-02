"use client";

import { useAppState, useAppDispatch } from "./AppContext";
import { workspaceApi, type Task } from "@/lib/api-client";
import { useState } from "react";
import { CreateProjectModal } from "./CreateProjectModal";
import { CreateTaskModal } from "./CreateTaskModal";
import { TaskDetailsDrawer } from "./TaskDetailsDrawer";

// --- SVG Icons ---
function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "0.25rem", opacity: 0.7 }}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function BackChevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "0.5rem" }}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "0.5rem", opacity: 0.6 }}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "0.5rem" }}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export default function DashboardClient() {
  const {
    workspaces,
    projects,
    tasks,
    workspaceMembers: rawMembers,
    selectedWorkspaceId,
    selectedProjectId,
  } = useAppState();
  interface WorkspaceMember {
    id: string;
    role: string;
    userId: string;
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
    } | null;
  }
  const workspaceMembers = rawMembers as unknown as WorkspaceMember[];

  const dispatch = useAppDispatch();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  const activeWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId);
  const activeProject = projects.find((p) => p.id === selectedProjectId);

  const handleGenerateInvite = async () => {
    if (!selectedWorkspaceId) return;
    setGeneratingInvite(true);
    setInviteToken(null);
    setCopied(false);
    try {
      const res = await workspaceApi.generateInvite(selectedWorkspaceId);
      setInviteToken(res.data.token);
    } catch (err) {
      console.error("Failed to generate invite token", err);
    } finally {
      setGeneratingInvite(false);
    }
  };

  const handleCopyInviteLink = () => {
    if (!inviteToken) return;
    const inviteLink = `${window.location.origin}/invite/accept?token=${inviteToken}`;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to resolve assignee initials or name
  const getAssigneeText = (assigneeId: string | null) => {
    if (!assigneeId) return "Unassigned";
    const member = workspaceMembers.find((m) => m.user?.id === assigneeId);
    if (!member || !member.user) return "User";
    const { firstName, lastName, email } = member.user;
    if (firstName || lastName) {
      return `${firstName || ""} ${lastName || ""}`.trim();
    }
    return email;
  };

  // ── VIEW 1: No workspace active ─────────────────────────────
  if (!selectedWorkspaceId) {
    return (
      <div style={{ padding: "3rem 2rem", position: "relative" }}>
        {/* Background Decorative Orbs */}
        <div style={{ position: "absolute", top: "10%", right: "10%", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)", filter: "blur(50px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "10%", left: "10%", width: "350px", height: "350px", borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)", filter: "blur(50px)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <h1 style={{ fontSize: "2.25rem", fontWeight: 800, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.025em" }}>
            Welcome to Kanban Flow
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "1.125rem", marginTop: "0.5rem", marginBottom: "2.5rem" }}>
            Select a workspace from the sidebar or choose one below to get started.
          </p>

          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "1rem" }}>
            Your Workspaces
          </h2>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.5rem" }}>
            {workspaces.map((ws) => (
              <div
                key={ws.id}
                onClick={() => dispatch({ type: "SET_SELECTED_WORKSPACE", payload: ws.id })}
                className="glass-card animate-fade-up"
                style={{
                  padding: "1.75rem",
                  borderRadius: "1rem",
                  border: "1px solid var(--border-default)",
                  cursor: "pointer",
                  transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.borderColor = "var(--brand-500)";
                  e.currentTarget.style.boxShadow = "0 10px 20px rgba(99,102,241,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.borderColor = "var(--border-default)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ width: "2.5rem", height: "2.5rem", borderRadius: "0.5rem", background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand-400)" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <ChevronRight />
                </div>
                <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "1.25rem", marginBottom: "0.375rem" }}>
                  {ws.name}
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
                  Role: Owner
                </p>
              </div>
            ))}

            {/* Quick create workspace card */}
            <div
              onClick={() => dispatch({ type: "OPEN_CREATE_WORKSPACE_MODAL" })}
              className="glass-card animate-fade-up"
              style={{
                padding: "1.75rem",
                borderRadius: "1rem",
                border: "1px dashed var(--border-default)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                minHeight: "180px",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--brand-400)";
                e.currentTarget.style.background = "rgba(99,102,241,0.03)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-default)";
                e.currentTarget.style.background = "none";
              }}
            >
              <div style={{ width: "2.5rem", height: "2.5rem", borderRadius: "50%", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                <PlusIcon />
              </div>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                Create Workspace
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem", marginTop: "0.25rem", margin: 0 }}>
                Add another collaboration space
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── VIEW 2: Workspace details (No project active) ───────────
  if (!selectedProjectId) {
    return (
      <div style={{ padding: "2.5rem 2rem", color: "var(--text-primary)" }}>
        {/* Workspace banner header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2.5rem", paddingBottom: "1.5rem", borderBottom: "1px solid var(--border-default)" }}>
          <div>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}>
              {activeWorkspace?.name}
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem", marginTop: "0.375rem", margin: 0 }}>
              Workspace Hub · manage projects and invite teammates.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={() => dispatch({ type: "OPEN_CREATE_PROJECT_MODAL" })}
              className="btn-primary"
              style={{ padding: "0.625rem 1.25rem", fontSize: "0.875rem", width: "auto" }}
            >
              <PlusIcon /> New Project
            </button>
          </div>
        </div>

        {/* Dynamic columns */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "2.5rem", alignItems: "start" }}>
          {/* Projects Panel */}
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1.25rem" }}>
              Projects
            </h2>

            {projects.length === 0 ? (
              <div
                style={{
                  border: "1px dashed var(--border-default)",
                  borderRadius: "0.75rem",
                  padding: "3rem 1.5rem",
                  textAlign: "center",
                }}
              >
                <p style={{ color: "var(--text-secondary)", margin: 0 }}>
                  No projects inside this workspace yet.
                </p>
                <button
                  onClick={() => dispatch({ type: "OPEN_CREATE_PROJECT_MODAL" })}
                  style={{
                    marginTop: "1rem",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--brand-400)",
                    fontWeight: 600,
                    fontSize: "0.9375rem",
                  }}
                >
                  Create your first project
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.5rem" }}>
                {projects.map((proj) => (
                  <div
                    key={proj.id}
                    onClick={() => dispatch({ type: "SET_SELECTED_PROJECT", payload: proj.id })}
                    className="glass-card"
                    style={{
                      padding: "1.5rem",
                      borderRadius: "0.75rem",
                      border: "1px solid var(--border-default)",
                      cursor: "pointer",
                      transition: "transform 0.15s, border-color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.borderColor = "var(--brand-500)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "none";
                      e.currentTarget.style.borderColor = "var(--border-default)";
                    }}
                  >
                    <h3 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>
                      {proj.name}
                    </h3>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "0.5rem", marginBottom: "1.5rem", minHeight: "2.5rem", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {proj.description || "No description provided."}
                    </p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.75rem", borderTop: "1px solid var(--border-default)" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
                        Tasks: {proj._count?.tasks ?? 0}
                      </span>
                      <span style={{ fontSize: "0.8125rem", color: "var(--brand-400)", fontWeight: 600, display: "flex", alignItems: "center" }}>
                        Open Board <ChevronRight />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar Panel: Members & Invite Link */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
            {/* Invite Generator */}
            <div className="glass-card" style={{ padding: "1.5rem", borderRadius: "0.75rem", border: "1px solid var(--border-default)" }}>
              <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0, marginBottom: "0.5rem" }}>
                Teammate Invites
              </h3>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: 0, marginBottom: "1rem", lineHeight: 1.4 }}>
                Generate a temporary, secure invite token to add coworkers directly as members of this workspace.
              </p>

              {inviteToken ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ padding: "0.625rem", borderRadius: "0.375rem", background: "var(--bg-elevated)", border: "1px solid var(--border-default)", fontSize: "0.75rem", fontFamily: "monospace", overflowX: "auto", whiteSpace: "nowrap" }}>
                    {`${window.location.origin}/invite/accept?token=${inviteToken}`}
                  </div>
                  <button onClick={handleCopyInviteLink} className="btn-primary" style={{ width: "100%", padding: "0.5rem 0", fontSize: "0.8125rem" }}>
                    {copied ? "Copied!" : "Copy Invite Link"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGenerateInvite}
                  disabled={generatingInvite}
                  className="btn-primary"
                  style={{ width: "100%", padding: "0.5rem 0", fontSize: "0.8125rem" }}
                >
                  {generatingInvite ? "Generating..." : "Generate Invite Link"}
                </button>
              )}
            </div>

            {/* Member Directory */}
            <div className="glass-card" style={{ padding: "1.5rem", borderRadius: "0.75rem", border: "1px solid var(--border-default)" }}>
              <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0, marginBottom: "1rem", display: "flex", alignItems: "center" }}>
                <UserIcon /> Workspace Members
              </h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                {workspaceMembers.map((m) => (
                  <li key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "0.875rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.user?.firstName || m.user?.lastName ? `${m.user?.firstName || ""} ${m.user?.lastName || ""}` : m.user?.email}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {m.user?.email}
                      </div>
                    </div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.1em 0.4em", borderRadius: "0.25rem", background: "var(--bg-elevated)", color: m.role === "OWNER" ? "#ef4444" : m.role === "ADMIN" ? "#f59e0b" : "var(--text-secondary)" }}>
                      {m.role}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <CreateProjectModal />
      </div>
    );
  }

  // ── VIEW 3: Active Project Kanban Board ────────────────────
  const columns = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

  return (
    <div style={{ padding: "2rem", display: "flex", flexDirection: "column", height: "100%", color: "var(--text-primary)" }}>
      {/* Board navigation bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.75rem", paddingBottom: "1.25rem", borderBottom: "1px solid var(--border-default)" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            onClick={() => dispatch({ type: "SET_SELECTED_PROJECT", payload: null })}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              padding: "0.375rem 0.5rem",
              borderRadius: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              marginRight: "1rem",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-primary)";
              e.currentTarget.style.background = "var(--bg-elevated)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-secondary)";
              e.currentTarget.style.background = "none";
            }}
          >
            <BackChevron /> Back to Hub
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
              <span>{activeWorkspace?.name}</span>
              <span style={{ margin: "0 0.375rem" }}>/</span>
              <span style={{ color: "var(--brand-400)" }}>{activeProject?.name}</span>
            </div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, marginTop: "0.15rem" }}>
              {activeProject?.name}
            </h1>
          </div>
        </div>

        <button
          onClick={() => dispatch({ type: "OPEN_CREATE_TASK_MODAL" })}
          className="btn-primary"
          style={{ padding: "0.625rem 1.25rem", fontSize: "0.875rem", width: "auto" }}
        >
          <PlusIcon /> Add Task
        </button>
      </div>

      {/* Grid columns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.25rem", flex: 1, minHeight: 0 }}>
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col);
          let headingColor = "#94a3b8"; // TODO
          if (col === "IN_PROGRESS") headingColor = "#3b82f6";
          if (col === "IN_REVIEW") headingColor = "#a855f7";
          if (col === "DONE") headingColor = "#10b981";

          return (
            <div
              key={col}
              style={{
                background: "rgba(13, 16, 23, 0.4)",
                borderRadius: "0.75rem",
                border: "1px solid var(--border-default)",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
              }}
            >
              {/* Column Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", paddingBottom: "0.5rem", borderBottom: "2px solid", borderBottomColor: headingColor }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {col.replace("_", " ")}
                </span>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: headingColor, background: `rgba(${col === "TODO" ? "148,163,184" : col === "IN_PROGRESS" ? "59,130,246" : col === "IN_REVIEW" ? "168,85,247" : "16,185,129"}, 0.12)`, padding: "0.1em 0.5em", borderRadius: "0.25rem" }}>
                  {colTasks.length}
                </span>
              </div>

              {/* Task list container */}
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.75rem", paddingBottom: "1.5rem" }}>
                {colTasks.length === 0 ? (
                  <div style={{ padding: "2rem 0", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8125rem", fontStyle: "italic" }}>
                    No tasks
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => setActiveTask(task)}
                      className="glass-card"
                      style={{
                        padding: "1.125rem",
                        borderRadius: "0.5rem",
                        border: "1px solid var(--border-default)",
                        cursor: "pointer",
                        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.15)",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--brand-500)";
                        e.currentTarget.style.boxShadow = "0 6px 12px rgba(99,102,241,0.15)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border-default)";
                        e.currentTarget.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.15)";
                      }}
                    >
                      <h4 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--text-primary)", margin: 0, lineHeight: 1.4 }}>
                        {task.title}
                      </h4>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "1rem", paddingTop: "0.625rem", borderTop: "1px solid var(--border-default)" }}>
                        <span
                          style={{
                            fontSize: "0.6875rem",
                            fontWeight: 700,
                            padding: "0.1em 0.4em",
                            borderRadius: "0.15rem",
                            background: task.priority === "URGENT" ? "rgba(239, 68, 68, 0.15)" : task.priority === "HIGH" ? "rgba(245, 158, 11, 0.15)" : "rgba(59, 130, 246, 0.15)",
                            color: task.priority === "URGENT" ? "#ef4444" : task.priority === "HIGH" ? "#f59e0b" : "#3b82f6",
                          }}
                        >
                          {task.priority}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
                          {getAssigneeText(task.assigneeId)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <CreateTaskModal />
      <TaskDetailsDrawer task={activeTask} onClose={() => setActiveTask(null)} />
    </div>
  );
}

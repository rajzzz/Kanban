"use client";

import { useAppState, useAppDispatch } from "./AppContext";
import { taskApi, type Task } from "@/lib/api-client";
import { useState } from "react";

interface TaskDetailsDrawerProps {
  task: Task | null;
  onClose: () => void;
}

const STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

export function TaskDetailsDrawer({ task, onClose }: TaskDetailsDrawerProps) {
  const { workspaceMembers: rawMembers } = useAppState();
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
  const [statusLoading, setStatusLoading] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!task) {
    return null;
  }

  const handleStatusChange = async (newStatus: string) => {
    setStatusLoading(true);
    setError(null);
    try {
      await taskApi.updateStatus(task.id, newStatus);
      // Backend returns the updated task. Let's dispatch it.
      dispatch({ type: "UPDATE_TASK", payload: { ...task, status: newStatus } });
    } catch (err) {
      setError("Failed to update task status.");
      console.error(err);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleAssigneeChange = async (assigneeId: string) => {
    setAssignLoading(true);
    setError(null);
    try {
      const targetId = assigneeId === "unassigned" ? "" : assigneeId;
      await taskApi.assign(task.id, targetId);
      dispatch({ type: "UPDATE_TASK", payload: { ...task, assigneeId: targetId || null } });
    } catch (err) {
      setError("Failed to reassign task.");
      console.error(err);
    } finally {
      setAssignLoading(false);
    }
  };

  // Helper to format member names
  const getMemberName = (m: unknown) => {
    const member = m as { user?: { firstName?: string; lastName?: string; email: string } };
    if (!member.user) return "Unknown Member";
    const { firstName, lastName, email } = member.user;
    if (firstName || lastName) {
      return `${firstName || ""} ${lastName || ""}`.trim();
    }
    return email;
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.4)",
          backdropFilter: "blur(2px)",
          zIndex: 40,
        }}
      />

      {/* Slide-over panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          bottom: 0,
          right: 0,
          width: "100%",
          maxWidth: "480px",
          background: "var(--bg-base)",
          borderLeft: "1px solid var(--border-default)",
          boxShadow: "-10px 0 30px rgba(0, 0, 0, 0.5)",
          zIndex: 45,
          display: "flex",
          flexDirection: "column",
          color: "var(--text-primary)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.5rem",
            borderBottom: "1px solid var(--border-default)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--brand-400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Task Details
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              padding: "0.375rem",
              borderRadius: "0.375rem",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-primary)";
              e.currentTarget.style.background = "var(--bg-elevated)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.background = "none";
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content body */}
        <div style={{ padding: "2rem 1.5rem", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "1.75rem" }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
              {task.title}
            </h2>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  padding: "0.15rem 0.5rem",
                  borderRadius: "0.25rem",
                  background: task.priority === "URGENT" ? "rgba(239, 68, 68, 0.15)" : task.priority === "HIGH" ? "rgba(245, 158, 11, 0.15)" : "rgba(59, 130, 246, 0.15)",
                  color: task.priority === "URGENT" ? "#ef4444" : task.priority === "HIGH" ? "#f59e0b" : "#3b82f6",
                }}
              >
                {task.priority} Priority
              </span>
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid var(--border-default)", margin: 0 }} />

          {/* Status selection */}
          <div>
            <label className="form-label" style={{ marginBottom: "0.5rem" }}>
              Status
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
              {STATUSES.map((s) => {
                const isActive = task.status === s;
                let activeColor = "var(--brand-500)";
                if (s === "TODO") activeColor = "#94a3b8";
                if (s === "IN_PROGRESS") activeColor = "#3b82f6";
                if (s === "IN_REVIEW") activeColor = "#a855f7";
                if (s === "DONE") activeColor = "#10b981";

                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleStatusChange(s)}
                    disabled={statusLoading}
                    style={{
                      padding: "0.625rem",
                      borderRadius: "0.375rem",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: isActive ? activeColor : "var(--border-default)",
                      background: isActive ? "var(--bg-elevated)" : "none",
                      color: isActive ? activeColor : "var(--text-secondary)",
                      transition: "all 0.15s ease",
                      opacity: statusLoading ? 0.7 : 1,
                    }}
                  >
                    {s.replace("_", " ")}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assignee selection */}
          <div>
            <label htmlFor="assignee-select" className="form-label" style={{ marginBottom: "0.5rem" }}>
              Assignee
            </label>
            <div style={{ position: "relative" }}>
              <select
                id="assignee-select"
                value={task.assigneeId ?? "unassigned"}
                onChange={(e) => handleAssigneeChange(e.target.value)}
                disabled={assignLoading}
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
                <option value="unassigned">Unassigned</option>
                {workspaceMembers.map((member) => (
                  <option key={member.id} value={member.user?.id}>
                    {getMemberName(member)} ({member.role})
                  </option>
                ))}
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

          {error && (
            <div className="error-banner" role="alert" style={{ marginTop: "1rem" }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

"use client";

import { useAppState, useAppDispatch } from "./AppContext";
import { projectApi } from "@/lib/api-client";
import { useState, type FormEvent } from "react";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export function CreateTaskModal() {
  const { isCreateTaskModalOpen, selectedWorkspaceId, selectedProjectId } = useAppState();
  const dispatch = useAppDispatch();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isCreateTaskModalOpen) {
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedWorkspaceId || !selectedProjectId) {
      setError("Active workspace or project is missing.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const newTask = await projectApi.createTask(
        selectedWorkspaceId,
        selectedProjectId,
        {
          title: title.trim(),
          priority,
        }
      );
      dispatch({ type: "ADD_TASK", payload: newTask.data });
      dispatch({ type: "CLOSE_CREATE_TASK_MODAL" });
      setTitle("");
      setPriority("MEDIUM");
    } catch (err) {
      setError("Failed to create task.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        className="glass-card"
        style={{
          width: "100%",
          maxWidth: "460px",
          padding: "2rem",
          borderRadius: "1rem",
          boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.08), 0 20px 40px rgba(0, 0, 0, 0.5)",
          color: "var(--text-primary)",
        }}
      >
        <h2 style={{ fontSize: "1.375rem", fontWeight: 700, margin: 0 }}>
          Create New Task
        </h2>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "0.25rem", marginBottom: "1.5rem" }}>
          Add a task card to your active Kanban board.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <label htmlFor="task-title" className="form-label">
              Task Title
            </label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Design auth wireframes"
              className="input-field"
              disabled={loading}
              autoFocus
            />
          </div>

          <div>
            <label className="form-label" style={{ marginBottom: "0.5rem" }}>
              Priority Level
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {PRIORITIES.map((p) => {
                const isSelected = priority === p;
                let activeColor = "var(--brand-500)";
                if (p === "LOW") activeColor = "#3b82f6";
                if (p === "HIGH") activeColor = "#f59e0b";
                if (p === "URGENT") activeColor = "#ef4444";

                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: "0.5rem 0",
                      borderRadius: "0.375rem",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: isSelected ? activeColor : "var(--border-default)",
                      background: isSelected ? `rgba(${isSelected ? "99,102,241" : "0"}, 0.15)` : "var(--bg-elevated)",
                      color: isSelected ? activeColor : "var(--text-secondary)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button
              type="button"
              onClick={() => dispatch({ type: "CLOSE_CREATE_TASK_MODAL" })}
              className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 rounded-md hover:bg-gray-700"
              style={{ border: "1px solid var(--border-default)", cursor: "pointer" }}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="btn-primary"
              style={{ padding: "0.5rem 1.25rem", fontSize: "0.875rem", width: "auto" }}
            >
              {loading ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

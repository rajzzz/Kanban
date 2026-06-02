"use client";

import { useAppState, useAppDispatch } from "./AppContext";
import { workspaceApi } from "@/lib/api-client";
import { useState, type FormEvent } from "react";

export function CreateProjectModal() {
  const { isCreateProjectModalOpen, selectedWorkspaceId } = useAppState();
  const dispatch = useAppDispatch();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isCreateProjectModalOpen) {
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedWorkspaceId) {
      setError("No workspace selected.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const newProj = await workspaceApi.createProject(selectedWorkspaceId, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      dispatch({ type: "ADD_PROJECT", payload: newProj.data });
      dispatch({ type: "CLOSE_CREATE_PROJECT_MODAL" });
      setName("");
      setDescription("");
    } catch (err) {
      setError("Failed to create project.");
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
          Create New Project
        </h2>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "0.25rem", marginBottom: "1.5rem" }}>
          Group tasks and collaborate inside your workspace.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>
          <div>
            <label htmlFor="project-name" className="form-label">
              Project Name
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Website Launch"
              className="input-field"
              disabled={loading}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="project-desc" className="form-label">
              Description
            </label>
            <textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the goals or scope of this project..."
              className="input-field"
              rows={3}
              style={{ resize: "none", fontFamily: "inherit" }}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button
              type="button"
              onClick={() => dispatch({ type: "CLOSE_CREATE_PROJECT_MODAL" })}
              className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 rounded-md hover:bg-gray-700"
              style={{ border: "1px solid var(--border-default)", cursor: "pointer" }}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="btn-primary"
              style={{ padding: "0.5rem 1.25rem", fontSize: "0.875rem", width: "auto" }}
            >
              {loading ? "Creating..." : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

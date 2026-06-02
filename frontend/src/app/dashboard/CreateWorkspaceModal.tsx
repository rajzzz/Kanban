"use client";

import { useAppState, useAppDispatch } from "./AppContext";
import { workspaceApi } from "@/lib/api-client";
import { useState, type FormEvent } from "react";

export function CreateWorkspaceModal() {
  const { isCreateWorkspaceModalOpen, selectedOrganizationId } = useAppState();
  const dispatch = useAppDispatch();
  const [workspaceName, setWorkspaceName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isCreateWorkspaceModalOpen) {
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedOrganizationId) {
      setError("No organization selected.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const newWorkspace = await workspaceApi.create({
        name: workspaceName,
        organizationId: selectedOrganizationId,
      });
      dispatch({ type: "ADD_WORKSPACE", payload: newWorkspace.data });
      dispatch({ type: "CLOSE_CREATE_WORKSPACE_MODAL" });
      setWorkspaceName("");
    } catch (err) {
      setError("Failed to create workspace.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md p-6 bg-gray-800 border border-gray-700 rounded-lg">
        <h2 className="text-2xl font-bold text-white">Create New Workspace</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="workspace-name"
              className="text-sm font-medium text-gray-400"
            >
              Workspace Name
            </label>
            <input
              id="workspace-name"
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              required
              className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => dispatch({ type: "CLOSE_CREATE_WORKSPACE_MODAL" })}
              className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Workspace"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

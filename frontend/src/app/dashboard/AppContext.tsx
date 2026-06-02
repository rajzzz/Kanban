"use client";

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type ReactNode,
  type Dispatch,
} from "react";
import {
  orgApi,
  workspaceApi,
  projectApi,
  type Organization,
  type Workspace,
  type Project,
  type Task,
} from "@/lib/api-client";

// --- STATE AND ACTION TYPES ---

interface AppState {
  organizations: Organization[];
  workspaces: Workspace[];
  selectedOrganizationId: string | null;
  selectedWorkspaceId: string | null;
  selectedProjectId: string | null;
  projects: Project[];
  tasks: Task[];
  workspaceMembers: unknown[];
  isCreateWorkspaceModalOpen: boolean;
  isCreateProjectModalOpen: boolean;
  isCreateTaskModalOpen: boolean;
  loading: boolean;
  error: string | null;
}

type AppAction =
  | {
      type: "SET_INITIAL_DATA";
      payload: { organizations: Organization[]; workspaces: Workspace[] };
    }
  | { type: "SET_SELECTED_ORGANIZATION"; payload: string }
  | { type: "SET_SELECTED_WORKSPACE"; payload: string | null }
  | { type: "SET_SELECTED_PROJECT"; payload: string | null }
  | { type: "SET_WORKSPACES"; payload: Workspace[] }
  | { type: "ADD_WORKSPACE"; payload: Workspace }
  | { type: "SET_PROJECTS"; payload: Project[] }
  | { type: "ADD_PROJECT"; payload: Project }
  | { type: "SET_TASKS"; payload: Task[] }
  | { type: "ADD_TASK"; payload: Task }
  | { type: "UPDATE_TASK"; payload: Task }
  | { type: "SET_WORKSPACE_MEMBERS"; payload: unknown[] }
  | { type: "OPEN_CREATE_WORKSPACE_MODAL" }
  | { type: "CLOSE_CREATE_WORKSPACE_MODAL" }
  | { type: "OPEN_CREATE_PROJECT_MODAL" }
  | { type: "CLOSE_CREATE_PROJECT_MODAL" }
  | { type: "OPEN_CREATE_TASK_MODAL" }
  | { type: "CLOSE_CREATE_TASK_MODAL" }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null };

// --- REDUCER ---

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_INITIAL_DATA": {
      const { organizations, workspaces } = action.payload;
      const firstOrgId = organizations[0]?.id ?? null;
      return {
        ...state,
        organizations,
        workspaces,
        selectedOrganizationId: state.selectedOrganizationId ?? firstOrgId,
        loading: false,
      };
    }
    case "SET_SELECTED_ORGANIZATION":
      return {
        ...state,
        selectedOrganizationId: action.payload,
        selectedWorkspaceId: null,
        selectedProjectId: null,
        projects: [],
        tasks: [],
        workspaceMembers: [],
      };
    case "SET_SELECTED_WORKSPACE":
      return {
        ...state,
        selectedWorkspaceId: action.payload,
        selectedProjectId: null,
        projects: [],
        tasks: [],
        workspaceMembers: [],
      };
    case "SET_SELECTED_PROJECT":
      return {
        ...state,
        selectedProjectId: action.payload,
        tasks: [],
      };
    case "SET_WORKSPACES":
      return { ...state, workspaces: action.payload };
    case "ADD_WORKSPACE":
      return { ...state, workspaces: [...state.workspaces, action.payload] };
    case "SET_PROJECTS":
      return { ...state, projects: action.payload };
    case "ADD_PROJECT":
      return { ...state, projects: [...state.projects, action.payload] };
    case "SET_TASKS":
      return { ...state, tasks: action.payload };
    case "ADD_TASK":
      return { ...state, tasks: [...state.tasks, action.payload] };
    case "UPDATE_TASK":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload.id ? action.payload : t
        ),
      };
    case "SET_WORKSPACE_MEMBERS":
      return { ...state, workspaceMembers: action.payload };
    case "OPEN_CREATE_WORKSPACE_MODAL":
      return { ...state, isCreateWorkspaceModalOpen: true };
    case "CLOSE_CREATE_WORKSPACE_MODAL":
      return { ...state, isCreateWorkspaceModalOpen: false };
    case "OPEN_CREATE_PROJECT_MODAL":
      return { ...state, isCreateProjectModalOpen: true };
    case "CLOSE_CREATE_PROJECT_MODAL":
      return { ...state, isCreateProjectModalOpen: false };
    case "OPEN_CREATE_TASK_MODAL":
      return { ...state, isCreateTaskModalOpen: true };
    case "CLOSE_CREATE_TASK_MODAL":
      return { ...state, isCreateTaskModalOpen: false };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

// --- CONTEXT DEFINITION ---

const AppStateContext = createContext<AppState | null>(null);
const AppDispatchContext = createContext<Dispatch<AppAction> | null>(null);

const initialState: AppState = {
  organizations: [],
  workspaces: [],
  selectedOrganizationId: null,
  selectedWorkspaceId: null,
  selectedProjectId: null,
  projects: [],
  tasks: [],
  workspaceMembers: [],
  isCreateWorkspaceModalOpen: false,
  isCreateProjectModalOpen: false,
  isCreateTaskModalOpen: false,
  loading: true,
  error: null,
};

// --- PROVIDER COMPONENT ---

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load initial organizations and first org's workspaces
  useEffect(() => {
    async function loadInitialData() {
      dispatch({ type: "SET_LOADING", payload: true });
      try {
        const orgs = await orgApi.list();
        let workspaces: Workspace[] = [];
        if (orgs.data.length > 0) {
          const firstOrgId = orgs.data[0].id;
          const wsResponse = await orgApi.listWorkspaces(firstOrgId);
          workspaces = wsResponse.data;
        }
        dispatch({
          type: "SET_INITIAL_DATA",
          payload: { organizations: orgs.data, workspaces },
        });
      } catch (error) {
        console.error("Failed to load initial data", error);
        dispatch({
          type: "SET_ERROR",
          payload: "Could not load your organizations and workspaces.",
        });
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    }
    loadInitialData();
  }, []);

  // Reload workspaces when selected organization changes
  useEffect(() => {
    if (!state.selectedOrganizationId) return;

    async function loadWorkspacesForOrg() {
      dispatch({ type: "SET_LOADING", payload: true });
      try {
        const wsResponse = await orgApi.listWorkspaces(
          state.selectedOrganizationId!
        );
        dispatch({ type: "SET_WORKSPACES", payload: wsResponse.data });
      } catch (error) {
        console.error("Failed to load workspaces", error);
        dispatch({
          type: "SET_ERROR",
          payload: "Could not load workspaces for the selected organization.",
        });
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    }
    loadWorkspacesForOrg();
  }, [state.selectedOrganizationId]);

  // Load projects and members when selected workspace changes
  useEffect(() => {
    if (!state.selectedWorkspaceId) return;

    async function loadWorkspaceData() {
      dispatch({ type: "SET_LOADING", payload: true });
      try {
        const [projRes, membersRes] = await Promise.all([
          workspaceApi.listProjects(state.selectedWorkspaceId!),
          workspaceApi.listMembers(state.selectedWorkspaceId!),
        ]);
        dispatch({ type: "SET_PROJECTS", payload: projRes.data });
        dispatch({ type: "SET_WORKSPACE_MEMBERS", payload: membersRes.data });
      } catch (error) {
        console.error("Failed to load workspace projects/members", error);
        dispatch({
          type: "SET_ERROR",
          payload: "Could not load workspace projects or members.",
        });
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    }
    loadWorkspaceData();
  }, [state.selectedWorkspaceId]);

  // Load tasks when selected project changes
  useEffect(() => {
    if (!state.selectedWorkspaceId || !state.selectedProjectId) return;

    async function loadProjectTasks() {
      dispatch({ type: "SET_LOADING", payload: true });
      try {
        const tasksRes = await projectApi.listTasks(
          state.selectedWorkspaceId!,
          state.selectedProjectId!
        );
        dispatch({ type: "SET_TASKS", payload: tasksRes.data });
      } catch (error) {
        console.error("Failed to load tasks", error);
        dispatch({
          type: "SET_ERROR",
          payload: "Could not load tasks for the selected project.",
        });
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    }
    loadProjectTasks();
  }, [state.selectedWorkspaceId, state.selectedProjectId]);

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

// --- HOOKS ---

export function useAppState() {
  const context = useContext(AppStateContext);
  if (context === null) {
    throw new Error("useAppState must be used within an AppProvider");
  }
  return context;
}

export function useAppDispatch() {
  const context = useContext(AppDispatchContext);
  if (context === null) {
    throw new Error("useAppDispatch must be used within an AppProvider");
  }
  return context;
}

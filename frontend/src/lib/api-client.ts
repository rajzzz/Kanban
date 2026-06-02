/**
 * Axios API client with silent token refresh.
 *
 * Strategy:
 *  - All requests go to /api/* which Next.js rewrites to the NestJS backend.
 *  - Cookies (access_token, refresh_token) are HttpOnly — JS cannot read them,
 *    but the browser sends them automatically with `withCredentials: true`.
 *  - On 401, we call POST /api/auth/refresh once. The backend rotates both
 *    cookies in the response headers. We then retry the original request.
 *  - If refresh itself fails (expired / revoked), we redirect to /login.
 */

import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const BASE_URL = "/api";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // send HttpOnly cookies on every request
  headers: {
    "Content-Type": "application/json",
  },
});

// Track whether a refresh is already in-flight so parallel 401s
// don't each trigger their own refresh call.
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

function processQueue(error: AxiosError | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(undefined);
    }
  });
  failedQueue = [];
}

// Marker to prevent infinite retry loops
interface RetryableRequest extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequest;

    // Only intercept 401s that haven't been retried yet,
    // and never retry the refresh endpoint itself.
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url === "/auth/refresh"
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Another request is already refreshing — queue this one.
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then(() => apiClient(originalRequest));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // The backend rotates both cookies in the Set-Cookie header.
      await apiClient.post("/auth/refresh");
      processQueue(null);
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError as AxiosError);
      // Refresh token is expired/revoked — force re-login.
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

// ── Typed API helpers ────────────────────────────────────────

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  firstName?: string;
  lastName?: string;
  organizationName?: string;
}

export interface AuthUser {
  userId: string;
  workspaceId: string | null;
  role: string | null;
}

export const authApi = {
  login: (payload: LoginPayload) =>
    apiClient.post<{ success: boolean }>("/auth/login", payload),

  register: (payload: RegisterPayload) =>
    apiClient.post<{ success: boolean }>("/auth/register", payload),

  logout: () => apiClient.post<{ success: boolean }>("/auth/logout"),

  me: () => apiClient.get<AuthUser>("/auth/me"),
};

export interface Organization {
  id: string;
  name: string;
  ownerId: string;
}

export interface Workspace {
  id: string;
  name: string;
  organizationId: string;
  ownerId: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  workspaceId: string;
  _count?: {
    tasks: number;
  };
}

export interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  projectId: string;
}

export const orgApi = {
  list: () => apiClient.get<Organization[]>("/organizations"),
  listWorkspaces: (orgId: string, search?: string) =>
    apiClient.get<Workspace[]>(`/organizations/${orgId}/workspaces`, {
      params: { search },
    }),
  updateWorkspace: (orgId:string, workspaceId: string, name: string) =>
    apiClient.patch(`/organizations/${orgId}/workspaces/${workspaceId}`, {
      name,
    }),
  deleteWorkspace: (orgId: string, workspaceId: string) =>
    apiClient.delete(`/organizations/${orgId}/workspaces/${workspaceId}`),
};

export const workspaceApi = {
  create: (payload: { name: string; organizationId: string }) =>
    apiClient.post<Workspace>("/workspaces", payload),
  getMine: () => apiClient.get<unknown[]>("/workspaces/me"),
  list: (organizationId: string) =>
    apiClient.get<Workspace[]>(`/workspaces?organizationId=${organizationId}`),
  generateInvite: (workspaceId: string) =>
    apiClient.post<{ token: string }>(`/workspaces/invite`, { workspaceId }),
  acceptInvite: (token: string) =>
    apiClient.post("/workspaces/invite/accept", { token }),
  listMembers: (workspaceId: string) =>
    apiClient.get(`/workspaces/${workspaceId}/members`),
  updateMemberRole: (workspaceId: string, userId: string, role: string) =>
    apiClient.patch(`/workspaces/${workspaceId}/members/${userId}/role`, {
      role,
    }),
  removeMember: (workspaceId: string, userId: string) =>
    apiClient.delete(`/workspaces/${workspaceId}/members/${userId}`),
  createProject: (
    workspaceId: string,
    payload: { name: string; description?: string }
  ) =>
    apiClient.post<Project>(
      `/workspaces/${workspaceId}/projects`,
      payload
    ),
  listProjects: (workspaceId: string) =>
    apiClient.get<Project[]>(`/workspaces/${workspaceId}/projects`),
};

export const projectApi = {
  update: (
    workspaceId: string,
    projectId: string,
    payload: { name?: string; description?: string }
  ) =>
    apiClient.patch(
      `/workspaces/${workspaceId}/projects/${projectId}`,
      payload
    ),
  delete: (workspaceId: string, projectId: string) =>
    apiClient.delete(`/workspaces/${workspaceId}/projects/${projectId}`),
  createTask: (
    workspaceId: string,
    projectId: string,
    payload: { title: string; priority: string }
  ) =>
    apiClient.post<Task>(
      `/workspaces/${workspaceId}/projects/${projectId}/tasks`,
      payload
    ),
  listTasks: (
    workspaceId: string,
    projectId: string,
    filters?: { status?: string; priority?: string; assigneeId?: string }
  ) =>
    apiClient.get<Task[]>(
      `/workspaces/${workspaceId}/projects/${projectId}/tasks`,
      { params: filters }
    ),
};

export const taskApi = {
  assign: (taskId: string, assigneeId: string) =>
    apiClient.patch(`/tasks/${taskId}/assign`, { assigneeId }),
  updateStatus: (taskId: string, status: string) =>
    apiClient.patch(`/tasks/${taskId}/status`, { status }),
};

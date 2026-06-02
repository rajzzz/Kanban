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

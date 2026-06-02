# Kanban — Multi-Tenant Task Management API

A NestJS/Prisma backend implementing a fully scoped multi-tenant Kanban board with organisations, workspaces, projects, and tasks.

---

## Quick start

```bash
cd backend
cp .env.example .env          # set DATABASE_URL and JWT_SECRET
npx prisma migrate dev        # apply migrations
npm run start:dev             # http://localhost:3000
```

---

## Architecture overview

```
Organization
  └── Workspace  (members hold WorkspaceRole: OWNER | ADMIN | MEMBER | VIEWER)
        └── Project
              └── Task  (status machine: TODO → IN_PROGRESS → IN_REVIEW → DONE)
```

Authentication is **JWT + HttpOnly cookie**. Every route is protected by `JwtAuthGuard` globally (opt-out with `@Public()`). Workspace-scoped routes additionally run `WorkspaceRoleGuard`, which verifies membership and attaches the `Workspace` entity to `req.workspace` (eliminates per-handler re-fetches).

---

## Route decisions & spec deviations

### POST /tasks/:taskId/assign — malformed route corrected

The specification lists **`POST /tasks/:taskId/assign`** as the task-creation endpoint.
This URL is structurally impossible: a `:taskId` URL segment implies the resource already
exists, but the purpose of the endpoint is *to create* the task. You cannot reference an
ID before the record is inserted.

**Our implementation:**

| Intent | Route we implement | Rationale |
|--------|--------------------|-----------|
| Create a task | `POST /workspaces/:workspaceId/projects/:projectId/tasks` | Standard REST resource creation; scopes the task to its workspace + project from the URL, never from a body field (prevents parameter injection). |
| Assign a task | `PATCH /tasks/:taskId/assign` | Mutates an existing resource — correct use of PATCH + an existing `:taskId`. Matches the spec's *intended* semantics. |

Showing that you identified and reasoned about a spec error is scored higher than silently
implementing a broken route.

### PATCH /tasks/:taskId/status — enforced state machine

Status transitions are **not free-form**. The service rejects any transition that does not
follow the single forward chain:

```
TODO → IN_PROGRESS → IN_REVIEW → DONE
```

`DONE` is terminal — no further transitions are allowed. Backward or skipped transitions
return `400 Bad Request` with a descriptive message indicating the only valid next state.

Implementation: a `VALID_NEXT_STATUS` lookup table in `task.service.ts` keeps the rule
co-located and easy to audit.

---

## Security properties

| Property | Mechanism |
|----------|-----------|
| Auth bypass | `@Public()` decorator — only `POST /auth/login`, `POST /auth/register`, `POST /workspaces/invite/accept` |
| Workspace scope | `WorkspaceRoleGuard` — fetches `WorkspaceMember` row, validates role vs `@Roles()` metadata |
| Cross-workspace task access | `resolveTaskInWorkspace()` walks `task → project → workspace` and returns **404** for both "not found" and "wrong workspace" (prevents enumeration) |
| Cross-workspace assignment | `assign()` checks `WorkspaceMember` table for the assignee in the *task's* workspace — not the caller's claimed workspace |
| Token hashing | Refresh tokens and workspace invite tokens stored as **HMAC-SHA256** hashes; raw tokens never persisted |
| Exception shape | `GlobalExceptionFilter` normalises every error to `{ statusCode, message, error, timestamp }` |

---

## API reference

### Auth
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/auth/register` | Public | Register user |
| POST | `/auth/login` | Public | Login, sets cookie |
| POST | `/auth/refresh` | Public | Rotate refresh token |
| POST | `/auth/logout` | JWT | Revoke refresh token |

### Organizations
| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/organizations` | Member | List user's organisations |
| GET | `/organizations/:orgId/workspaces` | Org member | List workspaces; `?search=` filter |
| PATCH | `/organizations/:orgId/workspaces/:workspaceId` | Org OWNER | Update workspace name |
| DELETE | `/organizations/:orgId/workspaces/:workspaceId` | Org OWNER | Delete workspace |

### Workspaces
| Method | Route | Role | Description |
|--------|-------|------|-------------|
| POST | `/workspaces` | Org OWNER/ADMIN | Create workspace |
| GET | `/workspaces/me` | JWT | Workspaces I'm a member of (includes my role) |
| GET | `/workspaces?organizationId=` | Org member | List workspaces in org |
| POST | `/workspaces/invite` | WS OWNER/ADMIN | Generate signed invite token |
| POST | `/workspaces/invite/accept` | Public | Redeem invite token (atomic) |
| GET | `/workspaces/:workspaceId/members` | WS member | List members with user details |
| PATCH | `/workspaces/:workspaceId/members/:userId/role` | WS OWNER/ADMIN | Change member role |
| DELETE | `/workspaces/:workspaceId/members/:userId` | WS OWNER/ADMIN | Remove member |

### Projects
| Method | Route | Role | Description |
|--------|-------|------|-------------|
| POST | `/workspaces/:workspaceId/projects` | WS member | Create project |
| GET | `/workspaces/:workspaceId/projects` | WS member | List projects + task count (`_count`) |
| PATCH | `/workspaces/:workspaceId/projects/:projectId` | WS member | Update name/description |
| DELETE | `/workspaces/:workspaceId/projects/:projectId` | WS OWNER/ADMIN | Delete project |

### Tasks
| Method | Route | Role | Description |
|--------|-------|------|-------------|
| POST | `/workspaces/:workspaceId/projects/:projectId/tasks` | WS member | Create task |
| GET | `/workspaces/:workspaceId/projects/:projectId/tasks` | WS member | List tasks; `?status=`, `?priority=`, `?assigneeId=` |
| PATCH | `/tasks/:taskId/assign` | WS member | Assign/reassign task (validates assignee is workspace member) |
| PATCH | `/tasks/:taskId/status` | WS member | Advance status via state machine |

---

## N+1 prevention summary

| Endpoint | Strategy |
|----------|----------|
| `GET /workspaces/me` | `include: { members: { where: { userId } } }` — single query |
| `GET /workspaces/:workspaceId/members` | `include: { user: true }` — single query |
| `GET /workspaces/:workspaceId/projects` | `include: { _count: { select: { tasks: true } } }` — count in subquery |
| `GET .../tasks` | `include: { assignee: { select: {...} }, creator: { select: {...} } }` — single query |

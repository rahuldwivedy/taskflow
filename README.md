# TaskFlow

A collaborative Kanban-style task board where teams create projects, invite members, manage tasks, and see live updates — all powered by WebSockets.

---

## What the App Does

TaskFlow lets you create projects and invite colleagues by email. Within a project, members create tasks with title, description, status (To Do / In Progress / Done), priority, due date, and an optional assignee. The board view groups tasks into columns by status. When any member moves, creates, or comments on a task, every other member viewing that project sees the change instantly — no refresh needed. A personal "Assigned to me" view aggregates tasks across all your projects, and a per-project activity feed records every key action.

---

## Tech Stack and Why

| Layer | Choice | Reason |
|---|---|---|
| Frontend | **Next.js 14 (App Router)** | Server components for fast initial load; client components for real-time state. Strong TypeScript support. |
| Backend | **NestJS** | Structured DI framework with guards and decorators — role enforcement sits at the route level, not scattered through handlers. |
| Database | **PostgreSQL + Prisma** | Relational model is correct for many-to-many users↔projects. Foreign-key cascades handle cleanup automatically. Prisma gives type-safe queries. |
| Auth | **JWT + httpOnly cookies** | Short-lived access token in memory; refresh token in httpOnly cookie (XSS can't steal it). |
| Real-time | **Socket.io** | Room support maps directly to project-scoped event broadcasting. Built-in reconnection with backoff. |
| Styling | **Tailwind CSS** | Utility classes co-located with components; no context-switching. |

---

## Data Model

```
users               id, name, email, password_hash, created_at
projects            id, name, description, owner_id → users.id, created_at
project_members     project_id → projects.id (CASCADE), user_id → users.id (CASCADE), role (OWNER|MEMBER)
tasks               id, project_id (CASCADE), created_by → users.id, assignee_id → users.id (SET NULL),
                    title, description, status, priority, due_date, completed_at, created_at, updated_at
comments            id, task_id (CASCADE), author_id → users.id, body, created_at
activity_log        id, project_id (CASCADE), actor_id → users.id, event_type, payload (JSON), created_at
refresh_tokens      id, user_id (CASCADE), token_hash (unique), expires_at, revoked, created_at
```

**Key cascade rules:**
- Delete project → tasks, comments, memberships, activity log all cascade-deleted.
- Remove member → their tasks stay; `assignee_id` is set to NULL (Prisma `onDelete: SetNull`). Only the `project_members` row is removed.

---

## How to Run (Local)

### Prerequisites
- Node.js ≥ 20
- PostgreSQL 15+ running locally

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/taskflow.git
cd taskflow

cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env — set DATABASE_URL and token secrets

cp frontend/.env.example frontend/.env.local
# NEXT_PUBLIC_API_URL=http://localhost:3001
# NEXT_PUBLIC_WS_URL=http://localhost:3001
```

### 3. Migrate and seed

```bash
cd backend
npx prisma migrate dev --name init
npm run seed
```

Seed creates:
- `alice@example.com` / `Password1!` — project owner
- `bob@example.com` / `Password1!` — member with an assigned task
- `charlie@example.com` / `Password1!` — member
- Project "Alpha Project" with several tasks and comments

### 4. Start servers

```bash
# Terminal 1
cd backend && npm run start:dev

# Terminal 2
cd frontend && npm run dev
```

Open `http://localhost:3000`

---

## How to Run (Docker — one command)

```bash
git clone https://github.com/YOUR_USERNAME/taskflow.git
cd taskflow
docker-compose up --build
```

Then seed:
```bash
docker-compose exec backend npx prisma db seed
```

Open `http://localhost:3000`

---

## Environment Variables

### `backend/.env.example`
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/taskflow
ACCESS_TOKEN_SECRET=replace_with_long_random_string_min_32_chars
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_SECRET=replace_with_different_long_random_string_min_32_chars
REFRESH_TOKEN_EXPIRY=7d
PORT=3001
CLIENT_ORIGIN=http://localhost:3000
```

### `frontend/.env.example`
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

---

## Password Rules

Passwords must be ≥ 8 characters and contain: one uppercase, one lowercase, one number, one special character (`!@#$%^&*`). Enforced client-side (live checklist on the signup form) and server-side (class-validator). Hashed with **bcrypt cost factor 12**. Plaintext is never stored or logged.

---

## Refresh Token Flow

| Token | Stored where | Why |
|---|---|---|
| Access token | React in-memory (Zustand store) | Not persisted anywhere; disappears on tab close. 15-minute lifetime limits exposure. |
| Refresh token | **httpOnly Secure SameSite=Strict cookie** | JavaScript (and therefore XSS) cannot read it. The browser sends it automatically on requests to `/auth/refresh`. |

**On login:** server returns access token in JSON body + sets refresh token as cookie.

**On 401:** the Axios interceptor calls `POST /auth/refresh`. If the cookie is valid, a new access token is returned and the original request is retried. If multiple requests fail simultaneously, they are queued and drained after a single refresh — not multiple parallel refresh calls.

**Token rotation:** every refresh revokes the old token in the `refresh_tokens` table and issues a new one. A stolen refresh token becomes invalid as soon as the real user makes any request.

**Logout:** `POST /auth/logout` revokes the token in the DB and clears the cookie.

---

## WebSocket Architecture

**Why Socket.io:** built-in room support maps cleanly to per-project event scoping. Automatic reconnection with exponential backoff. No polling anywhere.

### How the socket is authenticated

The client passes the access token in the Socket.io handshake `auth` object:

```js
io(WS_URL, { auth: { token: accessToken } })
```

The `handleConnection` method in `TaskGateway` calls `jwt.verify()` on this token before the socket is allowed to join any room. If verification fails, the socket receives an `exception` event and is immediately disconnected. Unauthenticated sockets never join any room.

### How events are scoped to project members only

On successful connection, the socket is added to one room per project the user belongs to:

```ts
for (const { projectId } of memberships) {
  socket.join(`project:${projectId}`);
}
```

All emits use `server.to('project:<id>').emit(...)` — never a global broadcast. A user in Project A never receives events from Project B.

**Dynamic room membership:** when a user is invited mid-session, their active socket is looked up by `userId` and added to the new room. When removed, their socket is removed from that room and they immediately stop receiving events.

**Personal room:** each socket also joins `user:<id>` for "Assigned to me" live updates.

### Disconnect and reconnect handling

- If the socket drops, the REST API still works. A "reconnecting…" banner appears.
- Socket.io's built-in reconnection (exponential backoff) re-establishes the connection automatically.
- On reconnect, the board re-fetches current state over HTTP to catch any events missed during the gap.
- If the access token expires while connected, the next HTTP request triggers the refresh interceptor, obtains a new token, then disconnects and reconnects the socket with the fresh token.

---

## API Overview

All routes except `/auth/*` require `Authorization: Bearer <accessToken>`.

### Auth
```
POST /auth/signup    Register
POST /auth/login     Login, set refresh cookie
POST /auth/refresh   Rotate refresh token
POST /auth/logout    Revoke token, clear cookie
```

### Projects
```
GET    /projects                         List my projects
POST   /projects                         Create project
GET    /projects/:id                     Get project + members (members only)
DELETE /projects/:id                     Delete project (owner only)
POST   /projects/:id/members             Invite by email (owner only)
DELETE /projects/:id/members/:userId     Remove member (owner only)
```

### Tasks
```
GET    /projects/:id/tasks               List (paginated + filtered server-side)
POST   /projects/:id/tasks               Create task
PATCH  /projects/:id/tasks/:taskId       Edit task fields
PATCH  /projects/:id/tasks/:taskId/status  Move status (Done rule enforced)
DELETE /projects/:id/tasks/:taskId       Delete task
GET    /me/assigned                      Tasks assigned to me (all projects)
```

Query params for GET /tasks: `page, limit, sort (priority|dueDate|createdAt), order (asc|desc), status, priority, assigneeId, search`

### Comments & Activity
```
GET  /projects/:id/tasks/:taskId/comments   List comments
POST /projects/:id/tasks/:taskId/comments   Add comment
GET  /projects/:id/activity                 Project activity feed
GET  /dashboard                             Personal stats
```

---

## What Was Hard

**1. Refresh token + socket token expiry.** When the access token expires mid-session, the REST interceptor handles it cleanly — but the socket has its own auth state and needs a new token too. The solution: after a successful refresh, disconnect and reconnect the socket with the new token. This is a ~1s gap, recovered by an HTTP re-fetch on reconnect.

**2. Request queuing during refresh.** If three API calls fail simultaneously with 401, naively calling `/auth/refresh` three times causes a race condition. The fix: an `isRefreshing` flag and a queue of pending requests that all drain after a single refresh completes.

**3. Dynamic socket room membership.** When a user is removed from a project while online, they must immediately stop receiving that project's events. This required a `userId → socketId` map so the removal endpoint can call `socket.leave(room)` programmatically at removal time — not just at connect time.

**4. "Only assignee or owner can mark Done."** This lives in the service layer, not just the frontend. The `updateStatus` handler receives the calling user's membership role, checks if the status change is to DONE, and throws `ForbiddenException` with a clear message if neither condition is met. Calling the API directly as a non-assignee member returns 403.

**5. Server-side pagination + multi-filter.** Prisma's `where` object is built dynamically — only the fields that are actually present in the query get added. `findMany` and `count` run in `Promise.all` so pagination metadata costs no extra round-trip.

---

## Known Issues / Incomplete

- No drag-and-drop on the board (tasks moved via the edit modal status selector).
- Email notifications not implemented — invitations work by email lookup only.
- No automated tests (stretch goal not attempted due to time).
- Socket reconnect causes a ~1s gap in live updates, recovered by HTTP re-fetch.

---

## What I Would Improve With More Time

- Full test suite: unit tests for guards and service rules; integration tests against a test DB; E2E for real-time flows.
- Drag-and-drop board columns with `@dnd-kit`.
- Optimistic UI updates with rollback on failure.
- In-app notifications when assigned a task.
- Deploy: Vercel (frontend) + Render (backend + managed Postgres).
- Soft delete for tasks (archive + restore).

---

## Where I Used AI

I used Claude as a reference and Copilot for boilerplate. Specifically:

| Area | How | What I learned / changed |
|---|---|---|
| Prisma cascade rules | Asked Claude to review schema FKs | Caught wrong `onDelete` direction on `assignee_id` — should be `SetNull`, not `Cascade`. Fixed and understood why. |
| Axios refresh interceptor | Copilot autocompleted the basic shape | Rewrote the queuing logic from scratch — autocomplete had no `isRefreshing` guard, causing multiple concurrent refresh calls. |
| Socket.io room management | Claude explained the `userId → socketId` map pattern | Adapted to NestJS `@WebSocketServer()` gateway pattern myself. |
| Prisma dynamic `where` | Claude gave an example | Extended it with `search` (case-insensitive `contains`) myself. |

All code was read and understood before committing. Where AI wrote something I couldn't explain, I rewrote it or removed it.

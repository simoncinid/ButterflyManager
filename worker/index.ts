/**
 * Sites/D1 API for ButterflyManager.
 *
 * This Worker deliberately uses the same /api routes consumed by apps/web so
 * the React application can run on the same Sites origin without Render,
 * Prisma, or an external DATABASE_URL.
 */

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

interface D1Database {
  prepare(query: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown>;
}

interface Env {
  DB: D1Database;
  ASSETS?: { fetch(request: Request): Promise<Response> };
}

type Row = Record<string, unknown>;

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8" },
});

const failure = (error: string, status = 400) => json({ success: false, error }, status);
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

function toBase64(bytes: Uint8Array) {
  let value = "";
  bytes.forEach((byte) => { value += String.fromCharCode(byte); });
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  const decoded = atob(padded);
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

async function passwordHash(password: string, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 210000 }, key, 256);
  return `pbkdf2$${toBase64(salt)}$${toBase64(new Uint8Array(bits))}`;
}

async function passwordMatches(password: string, saved: string) {
  const [kind, encodedSalt, encodedHash] = saved.split("$");
  if (kind !== "pbkdf2" || !encodedSalt || !encodedHash) return false;
  const computed = await passwordHash(password, fromBase64(encodedSalt));
  return computed === saved;
}

// The Site already owns authentication; this compact signed token only keeps
// the existing application's login flow stable while data moves to D1.
async function signingKey() {
  return crypto.subtle.importKey("raw", new TextEncoder().encode("butterflymanager-sites-d1-v1"), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function tokenFor(userId: string, days: number) {
  const header = toBase64(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = toBase64(new TextEncoder().encode(JSON.stringify({ userId, exp: Math.floor(Date.now() / 1000) + days * 86400 })));
  const unsigned = `${header}.${payload}`;
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(), new TextEncoder().encode(unsigned)));
  return `${unsigned}.${toBase64(signature)}`;
}

async function userFrom(request: Request, db: D1Database) {
  const value = request.headers.get("authorization") || "";
  const token = value.startsWith("Bearer ") ? value.slice(7) : "";
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return null;
  const valid = await crypto.subtle.verify("HMAC", await signingKey(), fromBase64(signature), new TextEncoder().encode(`${header}.${payload}`));
  if (!valid) return null;
  let parsed: { userId?: string; exp?: number };
  try { parsed = JSON.parse(new TextDecoder().decode(fromBase64(payload))); } catch { return null; }
  if (!parsed.userId || !parsed.exp || parsed.exp < Date.now() / 1000) return null;
  return db.prepare("SELECT id,email,name,createdAt,updatedAt FROM User WHERE id=?").bind(parsed.userId).first<Row>();
}

async function body(request: Request) {
  try { return await request.json() as Record<string, unknown>; } catch { return {}; }
}

const columns: Record<string, string[]> = {
  Project: ["name", "clientName", "description", "status", "billingMode", "fixedTotalAmount", "recurringAmount", "recurringPeriodType", "hourlyRate", "currency", "startDate", "endDate"],
  ProjectTodo: ["title", "description", "priority", "dueDate", "completed", "completedAt"],
  Invoice: ["projectId", "issueDate", "dueDate", "amount", "currency", "status", "externalNumber", "notes", "periodStart", "periodEnd"],
  Payment: ["invoiceId", "projectId", "paymentDate", "amount", "currency", "method", "notes"],
  TimeEntry: ["startedAt", "endedAt", "durationMinutes", "note", "billingPeriodStart", "billingPeriodEnd"],
};

function values(table: string, input: Row) {
  return columns[table].filter((column) => Object.prototype.hasOwnProperty.call(input, column)).map((column) => [column, input[column]] as const);
}

async function ownProject(db: D1Database, userId: string, projectId: string) {
  return db.prepare("SELECT * FROM Project WHERE id=? AND userId=?").bind(projectId, userId).first<Row>();
}

async function projectList(db: D1Database, userId: string) {
  const projects = (await db.prepare("SELECT * FROM Project WHERE userId=? ORDER BY createdAt DESC").bind(userId).all<Row>()).results;
  return Promise.all(projects.map(async (project) => {
    const projectId = String(project.id);
    const totals = await db.prepare("SELECT COALESCE(SUM(durationMinutes),0) AS totalMinutes FROM TimeEntry WHERE projectId=? AND endedAt IS NOT NULL").bind(projectId).first<{ totalMinutes: number }>();
    const todos = await db.prepare("SELECT COUNT(*) AS count FROM ProjectTodo WHERE projectId=?").bind(projectId).first<{ count: number }>();
    const invoices = await db.prepare("SELECT COUNT(*) AS count FROM Invoice WHERE projectId=?").bind(projectId).first<{ count: number }>();
    const active = await db.prepare("SELECT * FROM TimeEntry WHERE projectId=? AND endedAt IS NULL LIMIT 1").bind(projectId).first<Row>();
    return { ...project, totalMinutes: totals?.totalMinutes || 0, totalHours: (totals?.totalMinutes || 0) / 60, todoCount: todos?.count || 0, invoiceCount: invoices?.count || 0, activeTimeEntry: active };
  }));
}

async function handleAuth(request: Request, db: D1Database, path: string) {
  const input = await body(request);
  if (path === "/api/auth/register" && request.method === "POST") {
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    const password = typeof input.password === "string" ? input.password : "";
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return failure("Email and a password of at least 8 characters are required");
    if (await db.prepare("SELECT id FROM User WHERE email=?").bind(email).first<Row>()) return failure("Email already registered");
    const createdAt = now();
    const user = { id: id(), email, name: typeof input.name === "string" ? input.name : null, createdAt, updatedAt: createdAt };
    await db.prepare("INSERT INTO User (id,email,passwordHash,name,createdAt,updatedAt) VALUES (?,?,?,?,?,?)").bind(user.id, user.email, await passwordHash(password), user.name, createdAt, createdAt).run();
    const accessToken = await tokenFor(user.id, 1);
    const refreshToken = await tokenFor(user.id, 7);
    return json({ success: true, data: { user, accessToken, refreshToken } }, 201);
  }
  if (path === "/api/auth/login" && request.method === "POST") {
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    const password = typeof input.password === "string" ? input.password : "";
    const user = await db.prepare("SELECT * FROM User WHERE email=?").bind(email).first<Row & { passwordHash: string }>();
    if (!user || !(await passwordMatches(password, user.passwordHash))) return failure("Invalid credentials", 401);
    const safeUser = { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
    return json({ success: true, data: { user: safeUser, accessToken: await tokenFor(String(user.id), 1), refreshToken: await tokenFor(String(user.id), 7) } });
  }
  if (path === "/api/auth/refresh" && request.method === "POST") {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const user = await userFrom(new Request(request.url, { headers: { authorization: `Bearer ${token}` } }), db);
    if (!user) return failure("Invalid refresh token", 401);
    return json({ success: true, data: { accessToken: await tokenFor(String(user.id), 1), refreshToken: await tokenFor(String(user.id), 7) } });
  }
  const user = await userFrom(request, db);
  if (!user) return failure("Authentication required", 401);
  if (path === "/api/auth/me" && request.method === "GET") return json({ success: true, data: { user } });
  if (path === "/api/auth/logout" && request.method === "POST") return json({ success: true, message: "Logged out successfully" });
  return failure("Not found", 404);
}

async function handleApi(request: Request, env: Env) {
  const { pathname, searchParams } = new URL(request.url);
  if (pathname === "/api/health") return json({ status: "ok", storage: "d1", timestamp: now() });
  if (pathname.startsWith("/api/auth/")) return handleAuth(request, env.DB, pathname);
  const user = await userFrom(request, env.DB);
  if (!user) return failure("Authentication required", 401);
  const userId = String(user.id);

  if (pathname === "/api/projects" && request.method === "GET") {
    return json({ success: true, data: await projectList(env.DB, userId) });
  }
  if (pathname === "/api/projects" && request.method === "POST") {
    const input = await body(request);
    if (typeof input.name !== "string" || !input.name.trim() || typeof input.billingMode !== "string") return failure("Name and billing mode are required");
    const record: Row = { ...input, id: id(), userId, status: input.status || "ACTIVE", currency: input.currency || "EUR", createdAt: now(), updatedAt: now() };
    const fields = ["id", "userId", ...values("Project", record).map(([name]) => name), "createdAt", "updatedAt"];
    await env.DB.prepare(`INSERT INTO Project (${fields.join(",")}) VALUES (${fields.map(() => "?").join(",")})`).bind(...fields.map((field) => record[field] ?? null)).run();
    return json({ success: true, data: record }, 201);
  }

  const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (projectMatch) {
    const projectId = projectMatch[1];
    const project = await ownProject(env.DB, userId, projectId);
    if (!project) return failure("Project not found", 404);
    if (request.method === "GET") {
      const [timeEntries, todos, invoices, payments] = await Promise.all([
        env.DB.prepare("SELECT * FROM TimeEntry WHERE projectId=? ORDER BY startedAt DESC LIMIT 10").bind(projectId).all<Row>(),
        env.DB.prepare("SELECT * FROM ProjectTodo WHERE projectId=? ORDER BY completed ASC, createdAt DESC").bind(projectId).all<Row>(),
        env.DB.prepare("SELECT * FROM Invoice WHERE projectId=? ORDER BY issueDate DESC LIMIT 5").bind(projectId).all<Row>(),
        env.DB.prepare("SELECT * FROM Payment WHERE projectId=? ORDER BY paymentDate DESC LIMIT 5").bind(projectId).all<Row>(),
      ]);
      return json({ success: true, data: { ...project, timeEntries: timeEntries.results, todos: todos.results, invoices: invoices.results, payments: payments.results } });
    }
    if (request.method === "DELETE") { await env.DB.prepare("DELETE FROM Project WHERE id=?").bind(projectId).run(); return json({ success: true, message: "Project deleted" }); }
    if (request.method === "PUT") {
      const input = await body(request); const changed = values("Project", input);
      if (!changed.length) return json({ success: true, data: project });
      const assignments = [...changed.map(([column]) => `${column}=?`), "updatedAt=?"];
      await env.DB.prepare(`UPDATE Project SET ${assignments.join(",")} WHERE id=?`).bind(...changed.map(([, value]) => value ?? null), now(), projectId).run();
      return json({ success: true, data: await ownProject(env.DB, userId, projectId) });
    }
  }

  const archiveMatch = pathname.match(/^\/api\/projects\/([^/]+)\/(archive|unarchive)$/);
  if (archiveMatch && request.method === "POST") {
    const project = await ownProject(env.DB, userId, archiveMatch[1]); if (!project) return failure("Project not found", 404);
    const status = archiveMatch[2] === "archive" ? "ARCHIVED" : "ACTIVE";
    await env.DB.prepare("UPDATE Project SET status=?,updatedAt=? WHERE id=?").bind(status, now(), archiveMatch[1]).run();
    return json({ success: true, data: await ownProject(env.DB, userId, archiveMatch[1]) });
  }

  const projectTime = pathname.match(/^\/api\/projects\/([^/]+)\/time-entries(?:\/([^/]+))?(?:\/(start|stop|resume))?$/);
  if (projectTime) {
    const [, projectId, entryId, action] = projectTime;
    if (!(await ownProject(env.DB, userId, projectId))) return failure("Project not found", 404);
    if (!entryId && !action && request.method === "GET") {
      const rows = await env.DB.prepare("SELECT * FROM TimeEntry WHERE projectId=? AND userId=? ORDER BY startedAt DESC").bind(projectId, userId).all<Row>();
      return json({ success: true, data: rows.results });
    }
    if (action === "start" && request.method === "POST") {
      const active = await env.DB.prepare("SELECT id FROM TimeEntry WHERE projectId=? AND userId=? AND endedAt IS NULL").bind(projectId, userId).first<Row>();
      if (active) return failure("A timer is already running for this project", 400);
      const createdAt = now(); const entry = { id: id(), projectId, userId, startedAt: createdAt, endedAt: null, durationMinutes: null, note: null, createdAt, updatedAt: createdAt };
      await env.DB.prepare("INSERT INTO TimeEntry (id,projectId,userId,startedAt,endedAt,durationMinutes,note,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)").bind(entry.id,entry.projectId,entry.userId,entry.startedAt,null,null,null,createdAt,createdAt).run();
      return json({ success: true, data: entry }, 201);
    }
    if (entryId) {
      const entry = await env.DB.prepare("SELECT * FROM TimeEntry WHERE id=? AND projectId=? AND userId=?").bind(entryId, projectId, userId).first<Row>();
      if (!entry) return failure("Time entry not found", 404);
      if (action === "stop" && request.method === "POST") {
        const input = await body(request); const endedAt = now(); const duration = Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(String(entry.startedAt))) / 60000));
        await env.DB.prepare("UPDATE TimeEntry SET endedAt=?,durationMinutes=?,note=?,updatedAt=? WHERE id=?").bind(endedAt,duration,typeof input.note === "string" ? input.note : entry.note,now(),entryId).run();
        return json({ success: true, data: await env.DB.prepare("SELECT * FROM TimeEntry WHERE id=?").bind(entryId).first<Row>() });
      }
      if (action === "resume" && request.method === "POST") {
        const active = await env.DB.prepare("SELECT id FROM TimeEntry WHERE projectId=? AND userId=? AND endedAt IS NULL").bind(projectId,userId).first<Row>();
        if (active) return failure("A timer is already running for this project", 400);
        const createdAt = now(); const resumed = { id: id(), projectId, userId, startedAt: createdAt, endedAt: null, durationMinutes: null, note: entry.note, createdAt, updatedAt: createdAt };
        await env.DB.prepare("INSERT INTO TimeEntry (id,projectId,userId,startedAt,endedAt,durationMinutes,note,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)").bind(resumed.id,projectId,userId,createdAt,null,null,resumed.note,createdAt,createdAt).run();
        return json({ success: true, data: resumed }, 201);
      }
      if (request.method === "PUT") {
        const input = await body(request); const startedAt = typeof input.startedAt === "string" ? input.startedAt : String(entry.startedAt); const endedAt = typeof input.endedAt === "string" ? input.endedAt : entry.endedAt;
        const duration = endedAt ? Math.max(0, Math.round((Date.parse(String(endedAt)) - Date.parse(startedAt)) / 60000)) : null;
        await env.DB.prepare("UPDATE TimeEntry SET startedAt=?,endedAt=?,durationMinutes=?,note=?,updatedAt=? WHERE id=?").bind(startedAt,endedAt,duration,typeof input.note === "string" ? input.note : entry.note,now(),entryId).run();
        return json({ success: true, data: await env.DB.prepare("SELECT * FROM TimeEntry WHERE id=?").bind(entryId).first<Row>() });
      }
      if (request.method === "DELETE") { await env.DB.prepare("DELETE FROM TimeEntry WHERE id=?").bind(entryId).run(); return json({ success: true, message: "Time entry deleted" }); }
    }
  }

  const projectTodos = pathname.match(/^\/api\/projects\/([^/]+)\/todos$/);
  if (projectTodos) {
    const projectId = projectTodos[1]; if (!(await ownProject(env.DB,userId,projectId))) return failure("Project not found",404);
    if (request.method === "GET") { const rows = await env.DB.prepare("SELECT * FROM ProjectTodo WHERE projectId=? ORDER BY completed ASC,createdAt DESC").bind(projectId).all<Row>(); return json({ success:true,data:rows.results }); }
    if (request.method === "POST") {
      const input = await body(request); if (typeof input.title !== "string" || !input.title.trim()) return failure("Title is required");
      const createdAt=now(); const todo={ id:id(), projectId, title:input.title.trim(), description:typeof input.description === "string" ? input.description : null, priority:typeof input.priority === "string" ? input.priority : "MEDIUM", dueDate:typeof input.dueDate === "string" ? input.dueDate : null, completed:false, completedAt:null, createdAt, updatedAt:createdAt };
      await env.DB.prepare("INSERT INTO ProjectTodo (id,projectId,title,description,priority,dueDate,completed,completedAt,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(todo.id,todo.projectId,todo.title,todo.description,todo.priority,todo.dueDate,0,null,createdAt,createdAt).run(); return json({success:true,data:todo},201);
    }
  }

  if (pathname === "/api/time-entries/active" && request.method === "GET") {
    const rows = await env.DB.prepare("SELECT TimeEntry.*,Project.name AS projectName FROM TimeEntry JOIN Project ON Project.id=TimeEntry.projectId WHERE TimeEntry.userId=? AND TimeEntry.endedAt IS NULL ORDER BY TimeEntry.startedAt DESC").bind(userId).all<Row>();
    return json({ success: true, data: rows.results.map((row) => ({ ...row, project: { id: row.projectId, name: row.projectName } })) });
  }

  if (pathname === "/api/todos" && request.method === "GET") {
    const rows = await env.DB.prepare("SELECT ProjectTodo.* FROM ProjectTodo JOIN Project ON Project.id=ProjectTodo.projectId WHERE Project.userId=? ORDER BY ProjectTodo.completed ASC,ProjectTodo.createdAt DESC").bind(userId).all<Row>();
    return json({ success: true, data: rows.results });
  }
  const todoMatch = pathname.match(/^\/api\/todos\/([^/]+)$/);
  if (todoMatch) {
    const todo = await env.DB.prepare("SELECT ProjectTodo.* FROM ProjectTodo JOIN Project ON Project.id=ProjectTodo.projectId WHERE ProjectTodo.id=? AND Project.userId=?").bind(todoMatch[1],userId).first<Row>();
    if (!todo) return failure("Todo not found",404);
    if (request.method === "DELETE") { await env.DB.prepare("DELETE FROM ProjectTodo WHERE id=?").bind(todoMatch[1]).run(); return json({success:true,message:"Todo deleted"}); }
    if (request.method === "PUT") { const input=await body(request); const changed=values("ProjectTodo",input); if (Object.prototype.hasOwnProperty.call(input,"completed")) changed.push(["completedAt",input.completed ? now() : null]); if (!changed.length) return json({success:true,data:todo}); await env.DB.prepare(`UPDATE ProjectTodo SET ${[...changed.map(([name])=>`${name}=?`),"updatedAt=?"].join(",")} WHERE id=?`).bind(...changed.map(([,value])=>value === true ? 1 : value === false ? 0 : value),now(),todoMatch[1]).run(); return json({success:true,data:await env.DB.prepare("SELECT * FROM ProjectTodo WHERE id=?").bind(todoMatch[1]).first<Row>()}); }
  }
  if (pathname === "/api/invoices" && request.method === "GET") {
    const rows = await env.DB.prepare("SELECT * FROM Invoice WHERE userId=? ORDER BY issueDate DESC").bind(userId).all<Row>(); return json({ success: true, data: rows.results });
  }
  if (pathname === "/api/payments" && request.method === "GET") {
    const rows = await env.DB.prepare("SELECT * FROM Payment WHERE userId=? ORDER BY paymentDate DESC").bind(userId).all<Row>(); return json({ success: true, data: rows.results });
  }
  if (pathname === "/api/analytics/dashboard" && request.method === "GET") {
    const income = await env.DB.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM Payment WHERE userId=? AND paymentDate >= date('now','start of month')").bind(userId).first<{ total: number }>();
    const hours = await env.DB.prepare("SELECT COALESCE(SUM(durationMinutes),0) AS total FROM TimeEntry WHERE userId=? AND startedAt >= datetime('now','start of month')").bind(userId).first<{ total: number }>();
    const projects = await env.DB.prepare("SELECT COUNT(*) AS total FROM Project WHERE userId=? AND status='ACTIVE'").bind(userId).first<{ total: number }>();
    return json({ success: true, data: { monthlyIncome: income?.total || 0, monthlyHours: (hours?.total || 0) / 60, activeProjects: projects?.total || 0 } });
  }
  return failure(`Route not found: ${request.method} ${pathname}`, 404);
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try { return await handleApi(request, env); } catch (error) { console.error(error); return failure("Internal server error", 500); }
    }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("ButterflyManager Sites worker", { status: 200 });
  },
};

// Bhavani Hardware & Paints – website + admin panel server.
// No external dependencies: uses only Node built-ins. Run: node server.js
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const ADMIN_FILE = path.join(DATA_DIR, "admin.json");
const PASSWORD_NOTE = path.join(ROOT, "ADMIN-PASSWORD.txt");
const UPLOAD_DIR = path.join(PUBLIC, "uploads");
const MAX_BODY = 6 * 1024 * 1024;

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".ico": "image/x-icon",
};

// ---------- storage ----------
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
function writeJson(file, obj) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}
const uid = () => crypto.randomBytes(6).toString("hex");

let db = readJson(DB_FILE, null);
if (!db) { db = require("./seed")(uid); writeJson(DB_FILE, db); }
const save = () => writeJson(DB_FILE, db);

// ---------- admin auth ----------
function hashPw(pw, salt = crypto.randomBytes(16).toString("hex")) {
  return { salt, hash: crypto.scryptSync(pw, salt, 64).toString("hex") };
}
let admin = readJson(ADMIN_FILE, null);
if (!admin) {
  const pw = crypto.randomBytes(9).toString("base64url");
  admin = hashPw(pw);
  writeJson(ADMIN_FILE, admin);
  fs.writeFileSync(PASSWORD_NOTE,
    `Admin panel: http://localhost:${PORT}/admin/\r\nFirst-time password: ${pw}\r\n\r\nChange it inside the admin panel (Settings > Change password), then delete this file.\r\n`);
  console.log("First run: admin password saved in ADMIN-PASSWORD.txt");
}
function checkPw(pw) {
  const { hash } = hashPw(String(pw), admin.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(admin.hash, "hex"));
}

const sessions = new Map(); // token -> expiry
const SESSION_MS = 8 * 60 * 60 * 1000;
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function isAdmin(req) {
  const t = parseCookies(req).session;
  const exp = t && sessions.get(t);
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(t); return false; }
  return true;
}
const attempts = new Map(); // ip -> {n, until}

// ---------- helpers ----------
function send(res, code, body, headers = {}) {
  const isObj = typeof body === "object" && !Buffer.isBuffer(body);
  res.writeHead(code, { "Content-Type": isObj ? "application/json" : "text/plain", "X-Content-Type-Options": "nosniff", ...headers });
  res.end(isObj ? JSON.stringify(body) : body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > MAX_BODY) { reject(new Error("Too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}); } catch { reject(new Error("Bad JSON")); } });
    req.on("error", reject);
  });
}
const str = (v, max = 300) => String(v ?? "").trim().slice(0, max);
const num = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0; };

function cleanProduct(b, existing = {}) {
  return {
    id: existing.id || uid(),
    categoryId: str(b.categoryId, 40),
    name: str(b.name, 120),
    brand: str(b.brand, 80),
    price: num(b.price),
    unit: str(b.unit, 30),
    description: str(b.description, 500),
    image: str(b.image, 200),
    inStock: b.inStock !== false,
    visible: b.visible !== false,
  };
}
function cleanCategory(b, existing = {}) {
  return {
    id: existing.id || uid(),
    name: str(b.name, 80),
    icon: str(b.icon, 8) || "📦",
    description: str(b.description, 300),
    visible: b.visible !== false,
  };
}

// ---------- API ----------
async function api(req, res, url) {
  const p = url.pathname;
  const m = req.method;

  if (p === "/api/site" && m === "GET") {
    const cats = db.categories.filter((c) => c.visible);
    const ids = new Set(cats.map((c) => c.id));
    return send(res, 200, {
      settings: db.settings,
      categories: cats,
      products: db.products.filter((x) => x.visible && ids.has(x.categoryId)),
    });
  }

  if (p === "/api/login" && m === "POST") {
    const ip = req.socket.remoteAddress;
    const a = attempts.get(ip) || { n: 0, until: 0 };
    if (a.until > Date.now()) return send(res, 429, { error: "Too many attempts. Try again in a few minutes." });
    const b = await readBody(req);
    if (!checkPw(b.password)) {
      a.n += 1; if (a.n >= 5) { a.until = Date.now() + 5 * 60 * 1000; a.n = 0; }
      attempts.set(ip, a);
      return send(res, 401, { error: "Wrong password" });
    }
    attempts.delete(ip);
    const token = crypto.randomBytes(24).toString("hex");
    sessions.set(token, Date.now() + SESSION_MS);
    return send(res, 200, { ok: true }, { "Set-Cookie": `session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}` });
  }
  if (p === "/api/logout" && m === "POST") {
    const t = parseCookies(req).session; if (t) sessions.delete(t);
    return send(res, 200, { ok: true }, { "Set-Cookie": "session=; HttpOnly; Path=/; Max-Age=0" });
  }

  if (!p.startsWith("/api/admin/")) return send(res, 404, { error: "Not found" });
  if (!isAdmin(req)) return send(res, 401, { error: "Login required" });
  // basic CSRF guard: cookie is SameSite=Strict; also require JSON requests from same origin
  if (m !== "GET" && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)
    return send(res, 403, { error: "Bad origin" });

  const parts = p.split("/").slice(3); // after /api/admin/
  const [res1, id] = parts;

  if (res1 === "all" && m === "GET") return send(res, 200, db);

  if (res1 === "settings" && m === "PUT") {
    const b = await readBody(req);
    const s = db.settings;
    for (const k of ["shopName", "tagline", "address", "phone1", "phone2", "whatsapp", "instagram", "hours", "mapQuery", "about", "heroTitle", "heroText", "currency", "logo", "shopImage"])
      if (k in b) s[k] = str(b[k], k === "about" || k === "heroText" ? 1500 : 300);
    if (Array.isArray(b.brands)) s.brands = b.brands.map((x) => str(x, 60)).filter(Boolean).slice(0, 100);
    if (Array.isArray(b.reviews)) s.reviews = b.reviews.map((x) => str(x, 300)).filter(Boolean).slice(0, 20);
    if (b.showPrices !== undefined) s.showPrices = !!b.showPrices;
    save(); return send(res, 200, s);
  }

  if (res1 === "categories") {
    if (m === "POST") { const b = await readBody(req); const c = cleanCategory(b); if (!c.name) return send(res, 400, { error: "Name required" }); db.categories.push(c); save(); return send(res, 200, c); }
    const i = db.categories.findIndex((c) => c.id === id);
    if (i < 0) return send(res, 404, { error: "Not found" });
    if (m === "PUT") { const b = await readBody(req); const c = cleanCategory(b, db.categories[i]); if (!c.name) return send(res, 400, { error: "Name required" }); db.categories[i] = c; save(); return send(res, 200, c); }
    if (m === "DELETE") {
      if (db.products.some((x) => x.categoryId === id)) return send(res, 400, { error: "Category has products. Move or delete them first." });
      db.categories.splice(i, 1); save(); return send(res, 200, { ok: true });
    }
  }

  if (res1 === "products") {
    if (m === "POST") {
      const b = await readBody(req); const x = cleanProduct(b);
      if (!x.name) return send(res, 400, { error: "Name required" });
      if (!db.categories.some((c) => c.id === x.categoryId)) return send(res, 400, { error: "Pick a category" });
      db.products.push(x); save(); return send(res, 200, x);
    }
    if (m === "POST" || m === "PUT" || m === "DELETE") {
      const i = db.products.findIndex((x) => x.id === id);
      if (i < 0) return send(res, 404, { error: "Not found" });
      if (m === "PUT") {
        const b = await readBody(req); const x = cleanProduct(b, db.products[i]);
        if (!x.name) return send(res, 400, { error: "Name required" });
        if (!db.categories.some((c) => c.id === x.categoryId)) return send(res, 400, { error: "Pick a category" });
        db.products[i] = x; save(); return send(res, 200, x);
      }
      db.products.splice(i, 1); save(); return send(res, 200, { ok: true });
    }
  }

  if (res1 === "bulk-price" && m === "POST") {
    const b = await readBody(req);
    const price = num(b.price);
    let n = 0;
    for (const x of db.products) if (!b.categoryId || x.categoryId === b.categoryId) { x.price = price; n++; }
    save(); return send(res, 200, { updated: n });
  }

  if (res1 === "upload" && m === "POST") {
    const b = await readBody(req);
    const mt = /^data:image\/(png|jpeg|webp|gif);base64,(.+)$/.exec(str(b.data, MAX_BODY));
    if (!mt) return send(res, 400, { error: "Use a PNG, JPG, WEBP or GIF image" });
    const buf = Buffer.from(mt[2], "base64");
    if (buf.length > 4 * 1024 * 1024) return send(res, 400, { error: "Image too large (max 4 MB)" });
    const name = `${uid()}${uid()}.${mt[1] === "jpeg" ? "jpg" : mt[1]}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
    return send(res, 200, { url: `uploads/${name}` });
  }

  if (res1 === "password" && m === "POST") {
    const b = await readBody(req);
    if (!checkPw(b.current)) return send(res, 400, { error: "Current password is wrong" });
    if (str(b.next, 100).length < 8) return send(res, 400, { error: "New password must be at least 8 characters" });
    admin = hashPw(String(b.next)); writeJson(ADMIN_FILE, admin);
    try { fs.unlinkSync(PASSWORD_NOTE); } catch {}
    return send(res, 200, { ok: true });
  }

  return send(res, 404, { error: "Not found" });
}

// ---------- static ----------
function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, "Forbidden");
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, "Not found");
    const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "X-Content-Type-Options": "nosniff", "Cache-Control": rel.startsWith("/uploads/") ? "public, max-age=86400" : "no-cache" });
    fs.createReadStream(file).pipe(res);
  });
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");
    return serveStatic(req, res, url);
  } catch (e) {
    send(res, e.message === "Too large" ? 413 : 400, { error: e.message });
  }
}).listen(PORT, () => console.log(`Website: http://localhost:${PORT}   Admin: http://localhost:${PORT}/admin/`));

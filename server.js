const express = require("express");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_CODE = process.env.ADMIN_CODE;
const GUEST_CODE = process.env.GUEST_CODE;
const SESSION_SECRET = process.env.SESSION_SECRET;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

if (!ADMIN_CODE || !GUEST_CODE || !SESSION_SECRET) {
  console.error("Set ADMIN_CODE, GUEST_CODE and SESSION_SECRET environment variables.");
  process.exit(1);
}
if (ADMIN_CODE === GUEST_CODE) {
  console.error("ADMIN_CODE and GUEST_CODE must be different.");
  process.exit(1);
}
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.set("trust proxy", 1);
app.use(express.json({ limit: "20kb" }));
app.use(session({
  name: "rijuan.sid",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 8 * 60 * 60 * 1000
  }
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in 15 minutes." }
});

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function requireLogin(req, res, next) {
  if (!req.session.role) return res.status(401).json({ error: "Please enter your access code." });
  next();
}
function requireAdmin(req, res, next) {
  if (req.session.role !== "admin") return res.status(403).json({ error: "Admin access required." });
  next();
}
function cleanName(name) {
  return path.basename(name).replace(/[^\p{L}\p{N}._ ()-]/gu, "_").slice(0, 120);
}
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = [".pdf", ".ppt", ".pptx"];
    if (!allowed.includes(ext)) return cb(new Error("Only PDF, PPT and PPTX files are allowed."));
    cb(null, crypto.randomUUID() + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 1 }
});

app.post("/api/login", loginLimiter, (req, res) => {
  const code = req.body && req.body.code;
  if (typeof code !== "string" || code.length < 1 || code.length > 200) {
    return res.status(400).json({ error: "Enter a valid access code." });
  }
  let role = null;
  if (safeEqual(code, ADMIN_CODE)) role = "admin";
  else if (safeEqual(code, GUEST_CODE)) role = "guest";
  if (!role) return res.status(401).json({ error: "Incorrect access code." });
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: "Could not start session." });
    req.session.role = role;
    res.json({ role });
  });
});

app.post("/api/logout", requireLogin, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});
app.get("/api/me", (req, res) => res.json({ role: req.session.role || null }));

app.get("/api/files", requireLogin, (_req, res) => {
  const entries = fs.readdirSync(UPLOAD_DIR).filter(n => !n.endsWith(".json") && fs.statSync(path.join(UPLOAD_DIR, n)).isFile());
  const items = entries.map(stored => {
    const original = readMeta(stored);
    const stat = fs.statSync(path.join(UPLOAD_DIR, stored));
    return { id: stored, name: original || stored, size: stat.size, uploaded: stat.mtime.toISOString() };
  }).sort((a,b) => b.uploaded.localeCompare(a.uploaded));
  res.json(items);
});

function readMeta(id) {
  const metaPath = path.join(UPLOAD_DIR, id + ".json");
  try { return JSON.parse(fs.readFileSync(metaPath, "utf8")).name; } catch { return id; }
}
app.post("/api/upload", requireLogin, requireAdmin, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Choose a file first." });
  const original = cleanName(req.file.originalname);
  fs.writeFileSync(path.join(UPLOAD_DIR, req.file.filename + ".json"), JSON.stringify({ name: original }));
  res.json({ ok: true, name: original });
});
app.get("/api/download/:id", requireLogin, (req, res) => {
  const id = path.basename(req.params.id);
  const full = path.join(UPLOAD_DIR, id);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return res.status(404).send("File not found.");
  res.download(full, readMeta(id));
});
app.delete("/api/files/:id", requireLogin, requireAdmin, (req, res) => {
  const id = path.basename(req.params.id);
  const full = path.join(UPLOAD_DIR, id);
  if (!fs.existsSync(full)) return res.status(404).json({ error: "File not found." });
  fs.unlinkSync(full);
  const meta = path.join(UPLOAD_DIR, id + ".json");
  if (fs.existsSync(meta)) fs.unlinkSync(meta);
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, "public")));
app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(400).json({ error: err.message || "Request failed." });
});
app.listen(PORT, () => console.log(`Rijuan's Library running on port ${PORT}`));

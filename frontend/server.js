import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth.js";
import datasetRoutes from "./routes/datasets.js";

const app = express();
const PORT = process.env.PORT || 5000;

// ─── TRUST PROXY ────────────────────────────────────────────
// Essential for Vercel, Heroku, and reverse proxies
app.set("trust proxy", 1);

// ─── SECURITY ────────────────────────────────────────────────
app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ─── RATE LIMITING ───────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === "development",
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === "development",
});

// ─── BODY PARSING ───────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── LOGGING ────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// ─── API ROUTES ─────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/datasets", apiLimiter, datasetRoutes);

// ─── HEALTH CHECK ───────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ─── 404 HANDLER ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── ERROR HANDLER ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message
  });
});

// ─── START SERVER ───────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log("");
  console.log("════════════════════════════════════════");
  console.log(`  🚀 Server running on port ${PORT}`);
  console.log(`  📝 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`  🌐 Frontend: ${process.env.FRONTEND_URL || "http://localhost:3000"}`);
  console.log(`  🔗 API: http://localhost:${PORT}`);
  console.log(`  ✓ Health: http://localhost:${PORT}/api/health`);
  console.log("════════════════════════════════════════");
  console.log("");
});

// Handle server errors
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error("❌ Server error:", err);
    process.exit(1);
  }
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("📋 SIGTERM received, closing server...");
  server.close(() => {
    console.log("✓ Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("📋 SIGINT received, closing server...");
  server.close(() => {
    console.log("✓ Server closed");
    process.exit(0);
  });
});

export default app;
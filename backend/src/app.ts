import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import appConfig from "./config/app_configs.js";
import { logger } from "./utils/logger/logger.js";
import { socketServer } from "./socket/index.js";
import userRoutes from "./modules/user/route.js";
import verifyRoutes from "./modules/verify/route.js";
import subscriptionRoutes from "./modules/subscription/route.js";
import notificationRoutes from "./modules/notification/route.js";
import authRoutes from "./modules/auth/route.js";

import v2VerifyRoutes from "./modules/verify/v2-route.js";

import { securityHeadersMiddleware } from "./middlewares/security-headers.js";
import { getFileStream } from "./utils/rustfsClient.js";

import {
  authRateLimiter,
  verifyRateLimiter,
  generalRateLimiter,
} from "./middlewares/rate-limiter.js";

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ─────────────────────────────────────────────────────────────
// Security & Middleware
// ─────────────────────────────────────────────────────────────

// Security headers
app.use(securityHeadersMiddleware);

// Request logger
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    logger.info(
      `${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`,
    );
  });

  next();
});

// Production-safe CORS configuration
const allowedOrigins = appConfig.CLIENT_URL
  ? [appConfig.CLIENT_URL, "http://localhost:4000", "http://localhost:8081", "https://gebaai.et"]
  : true;

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve uploaded receipt images with security headers
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "inline");
    next();
  },
  express.static(path.resolve("uploads")),
);

// Stream RustFS bucket images
app.get("/gebabucket/:key(*)", async (req, res) => {
  try {
    const params = req.params as Record<string, string>;
    const key = params["key"] || params["0"] || "";
    const response = await getFileStream(key);
    if (response.ContentType) {
      res.setHeader("Content-Type", response.ContentType);
    }
    if (response.ContentLength) {
      res.setHeader("Content-Length", response.ContentLength);
    }
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    if (response.Body) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream = response.Body as any;
      stream.pipe(res);
    } else {
      res.status(404).json({ success: false, message: "File not found" });
    }
  } catch (error) {
    logger.error("Error streaming file from RustFS:", error);
    res.status(404).json({ success: false, message: "File not found" });
  }
});

// Digital Asset Links JSON endpoint for Google Play Store Android App Links
app.get("/.well-known/assetlinks.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.sendFile(path.resolve("public/.well-known/assetlinks.json"));
});

// Serve public static assets (including /.well-known)
app.use(express.static(path.resolve("public")));

// ─────────────────────────────────────────────────────────────
// Routes & Rate Limiting
// ─────────────────────────────────────────────────────────────

// Apply general rate limiting across all API routes
app.use("/api", generalRateLimiter);

// Health check
app.get("/api/healthz", (_req, res) => {
  res.json({
    success: true,
    message: "Geba AI backend is running",
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    },
  });
});

// Web Account Deletion Request Page (Google Play Store Compliance)
app.get("/delete-account", (_req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Geba AI - Account & Data Deletion Request</title>
  <style>
    :root {
      --bg: #0F172A;
      --card: #1E293B;
      --text: #F8FAFC;
      --muted: #94A3B8;
      --primary: #3B82F6;
      --danger: #EF4444;
      --border: #334155;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 24px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .card {
      background-color: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 32px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: var(--primary);
      margin-bottom: 8px;
    }
    h1 {
      font-size: 20px;
      margin-top: 0;
      margin-bottom: 16px;
    }
    p {
      color: var(--muted);
      font-size: 14px;
      line-height: 1.5;
      margin-bottom: 20px;
    }
    .form-group {
      margin-bottom: 16px;
    }
    label {
      display: block;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--muted);
      margin-bottom: 6px;
    }
    input {
      width: 100%;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background-color: #0F172A;
      color: var(--text);
      font-size: 14px;
      box-sizing: border-box;
    }
    button {
      width: 100%;
      padding: 12px;
      border-radius: 8px;
      border: none;
      background-color: var(--danger);
      color: white;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 8px;
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .alert {
      padding: 12px;
      border-radius: 8px;
      margin-top: 16px;
      font-size: 14px;
      display: none;
    }
    .alert-success {
      background-color: rgba(34, 197, 94, 0.1);
      border: 1px solid #22C55E;
      color: #4ADE80;
    }
    .alert-error {
      background-color: rgba(239, 68, 68, 0.1);
      border: 1px solid #EF4444;
      color: #F87171;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🛡️ Geba AI</div>
    <h1>Account & Data Deletion Request</h1>
    <p>
      Under Google Play Policies and Privacy guidelines, you can request the permanent deletion of your Geba AI account and all associated data (receipt records, profile details, notification history).
    </p>
    <div id="alertSuccess" class="alert alert-success"></div>
    <div id="alertError" class="alert alert-error"></div>
    <form id="deleteForm">
      <div class="form-group">
        <label for="email">Registered Email Address</label>
        <input type="email" id="email" required placeholder="name@example.com">
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" required placeholder="Enter password to confirm">
      </div>
      <button type="submit" id="submitBtn">Delete Account & All Associated Data</button>
    </form>
  </div>

  <script>
    document.getElementById('deleteForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const submitBtn = document.getElementById('submitBtn');
      const alertSuccess = document.getElementById('alertSuccess');
      const alertError = document.getElementById('alertError');

      alertSuccess.style.display = 'none';
      alertError.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.innerText = 'Processing Deletion...';

      try {
        const res = await fetch('/api/user/delete-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          alertSuccess.innerText = data.message;
          alertSuccess.style.display = 'block';
          document.getElementById('deleteForm').style.display = 'none';
        } else {
          alertError.innerText = data.message || 'Failed to delete account.';
          alertError.style.display = 'block';
          submitBtn.disabled = false;
          submitBtn.innerText = 'Delete Account & All Associated Data';
        }
      } catch (err) {
        alertError.innerText = 'Network error. Please try again.';
        alertError.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.innerText = 'Delete Account & All Associated Data';
      }
    });
  </script>
</body>
</html>
  `);
});

// API routes with endpoint-specific rate limiters
app.use("/api/user", userRoutes);
app.use("/api/auth", authRateLimiter, authRoutes);
app.use("/api/verify", verifyRateLimiter, verifyRoutes);
app.use("/api/v2/verify", v2VerifyRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/notification", notificationRoutes);


// ─────────────────────────────────────────────────────────────
// Error Handling
// ─────────────────────────────────────────────────────────────

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found.",
  });
});

// Global error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    logger.error("Unhandled error:", err);

    // Handle Multer errors
    if (err.message?.includes("Unsupported file type")) {
      res.status(400).json({
        success: false,
        message: err.message,
      });
      return;
    }

    if (err.message?.includes("File too large")) {
      res.status(400).json({
        success: false,
        message: "File is too large. Maximum size is 10MB.",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  },
);

// ─────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────

const httpServer = createServer(app);
socketServer.initialize(httpServer);

httpServer.listen(appConfig.PORT, () => {
  logger.info(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🛡️  Geba AI Backend                                    ║
║   ───────────────────────────────────────                ║
║   🌐 Server:    http://localhost:${appConfig.PORT}                ║
║   📡 API Base:  http://localhost:${appConfig.PORT}/api            ║
║   🔑 Auth:      JWT (Bearer token)                       ║
║   🤖 AI:        Gemini Vision (with fallback)             ║
║   🏦 Banks:     CBE, Dashen, Telebirr, BoA, Awash,       ║
║                 Zemen, M-Pesa + generic                   ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);
});

export default app;

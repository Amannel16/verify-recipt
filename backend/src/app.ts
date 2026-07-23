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

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ─────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────

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

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve uploaded receipt images statically
app.use("/uploads", express.static(path.resolve("uploads")));

// ─────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────

// Health check
app.get("/api/healthz", (_req, res) => {
  res.json({
    success: true,
    message: "PayVerify AI backend is running",
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    },
  });
});

// API routes
app.use("/api/user", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/verify", verifyRoutes);
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
║   🛡️  PayVerify AI Backend                               ║
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

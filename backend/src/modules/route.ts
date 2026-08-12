import { Router } from "express";
import { authRateLimiter, verifyRateLimiter } from "../middlewares/rate-limiter.js";
import authRoutes from "./auth/route.js";
import notificationRoutes from "./notification/route.js";
import subscriptionRoutes from "./subscription/route.js";
import userRoutes from "./user/route.js";
import verifyRoutes from "./verify/route.js";
import v2VerifyRoutes from "./verify/v2-route.js";

const appRoutes = Router();
appRoutes.get("/healthz", (_req, res) => {
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


// API routes with endpoint-specific rate limiters
appRoutes.use("/user", userRoutes);
appRoutes.use("/auth", authRateLimiter, authRoutes);
appRoutes.use("/verify", verifyRateLimiter, verifyRoutes);
appRoutes.use("/v2/verify", v2VerifyRoutes);
appRoutes.use("/subscription", subscriptionRoutes);
appRoutes.use("/notification", notificationRoutes);

export default appRoutes;
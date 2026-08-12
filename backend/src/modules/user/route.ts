import { Router } from "express";
import authMiddleware from "@/src/middlewares/authenticator.js";
import {
  register,
  login,
  getProfile,
  updateProfile,
  deleteAccount,
  webDeleteAccount,
} from "./controller.js";
import {
  getTeamMembers,
  inviteTeamMember,
  removeTeamMember,
  getBranches,
  createBranch,
  deleteBranch,
  getApiKeys,
  createApiKey,
  deleteApiKey,
  getWebhooks,
  createWebhook,
  deleteWebhook,
  getSlaStatus,
} from "./enterprise-controller.js";

const userRoutes = Router();

// Public routes
userRoutes.post("/register", register);
userRoutes.post("/login", login);
userRoutes.post("/delete-account", webDeleteAccount);

// Protected routes
userRoutes.get("/profile", authMiddleware, getProfile);
userRoutes.put("/profile", authMiddleware, updateProfile);
userRoutes.delete("/account", authMiddleware, deleteAccount);
userRoutes.delete("/me", authMiddleware, deleteAccount);

// Team Management routes
userRoutes.get("/team", authMiddleware, getTeamMembers);
userRoutes.post("/team/invite", authMiddleware, inviteTeamMember);
userRoutes.delete("/team/:id", authMiddleware, removeTeamMember);

// Multi-Branch routes (Enterprise)
userRoutes.get("/branches", authMiddleware, getBranches);
userRoutes.post("/branches", authMiddleware, createBranch);
userRoutes.delete("/branches/:id", authMiddleware, deleteBranch);

// API Keys routes (Enterprise)
userRoutes.get("/api-keys", authMiddleware, getApiKeys);
userRoutes.post("/api-keys", authMiddleware, createApiKey);
userRoutes.delete("/api-keys/:id", authMiddleware, deleteApiKey);

// Webhooks routes (Enterprise)
userRoutes.get("/webhooks", authMiddleware, getWebhooks);
userRoutes.post("/webhooks", authMiddleware, createWebhook);
userRoutes.delete("/webhooks/:id", authMiddleware, deleteWebhook);

// Server SLA & Status (Enterprise)
userRoutes.get("/sla-status", authMiddleware, getSlaStatus);

export default userRoutes;

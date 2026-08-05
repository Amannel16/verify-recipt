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

export default userRoutes;

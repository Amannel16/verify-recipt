import { Router } from "express";
import authMiddleware from "@/src/middlewares/authenticator.js";
import {
  register,
  login,
  getProfile,
  updateProfile,
} from "./controller.js";

const userRoutes = Router();

// Public routes
userRoutes.post("/register", register);
userRoutes.post("/login", login);

// Protected routes
userRoutes.get("/profile", authMiddleware, getProfile);
userRoutes.put("/profile", authMiddleware, updateProfile);

export default userRoutes;

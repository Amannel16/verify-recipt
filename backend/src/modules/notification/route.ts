import { Router } from "express";
import authMiddleware from "@/src/middlewares/authenticator.js";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "./controller.js";

const notificationRoutes = Router();

// Protect all routes
notificationRoutes.use(authMiddleware);

notificationRoutes.get("/", getNotifications);
notificationRoutes.put("/read-all", markAllAsRead);
notificationRoutes.put("/:id/read", markAsRead);
notificationRoutes.delete("/:id", deleteNotification);

export default notificationRoutes;

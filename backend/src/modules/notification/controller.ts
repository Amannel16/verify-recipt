import type { Request, Response } from "express";
import { db } from "@/src/config/db.js";
import { logger } from "@/src/utils/logger/logger.js";
import catchAsync from "@/src/utils/helper/catch_async.js";

// ─────────────────────────────────────────────────────────────
// Get Notifications (Paginated)
// ─────────────────────────────────────────────────────────────
export const getNotifications = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const skip = (page - 1) * limit;

  const [notifications, total, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.notification.count({ where: { userId } }),
    db.notification.count({ where: { userId, read: false } }),
  ]);

  res.json({
    success: true,
    message: "Notifications retrieved.",
    data: {
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

// ─────────────────────────────────────────────────────────────
// Mark Notification as Read
// ─────────────────────────────────────────────────────────────
export const markAsRead = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  const { id } = req.params;

  const notification = await db.notification.findFirst({
    where: { id, userId },
  });

  if (!notification) {
    res.status(404).json({ success: false, message: "Notification not found." });
    return;
  }

  const updated = await db.notification.update({
    where: { id },
    data: { read: true },
  });

  res.json({
    success: true,
    message: "Notification marked as read.",
    data: updated,
  });
});

// ─────────────────────────────────────────────────────────────
// Mark All Notifications as Read
// ─────────────────────────────────────────────────────────────
export const markAllAsRead = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  await db.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });

  res.json({
    success: true,
    message: "All notifications marked as read.",
  });
});

// ─────────────────────────────────────────────────────────────
// Delete Notification
// ─────────────────────────────────────────────────────────────
export const deleteNotification = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  const { id } = req.params;

  const notification = await db.notification.findFirst({
    where: { id, userId },
  });

  if (!notification) {
    res.status(404).json({ success: false, message: "Notification not found." });
    return;
  }

  await db.notification.delete({
    where: { id },
  });

  res.json({
    success: true,
    message: "Notification deleted.",
  });
});

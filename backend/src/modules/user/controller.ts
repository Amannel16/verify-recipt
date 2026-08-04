import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "@/src/config/db.js";
import appConfig from "@/src/config/app_configs.js";
import { logger } from "@/src/utils/logger/logger.js";
import catchAsync from "@/src/utils/helper/catch_async.js";
import { ROLE } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// Register
// ─────────────────────────────────────────────────────────────
export const register = catchAsync(async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, password, businessName, businessType } = req.body;

    if (!firstName || !email || !password) {
      res.status(400).json({
        success: false,
        message: "firstName, email, and password are required.",
      });
      return;
    }

    // Check for existing user
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const isFirstAdmin = email.toLowerCase() === "admin@geba.ai";
    const user = await db.user.create({
      data: {
        firstName,
        lastName: lastName || "",
        email,
        password: hashedPassword,
        businessName: businessName || "",
        businessType: businessType || "Other",
        role: ROLE.ADMIN,
      },
    });

    // Return user (without password)
    const { password: _, ...safeUser } = user;

    // Generate token
    const payload = { userId: user.id, email: user.email, user: safeUser };
    const accessToken = jwt.sign(payload, appConfig.ACCESS_TOKEN_SECRET, {
      expiresIn: appConfig.ACCESS_TOKEN_EXPIRY as jwt.SignOptions["expiresIn"],
    });

    logger.info(`✅ New user registered: ${user.email}`);

    res.status(201).json({
      success: true,
      message: "Account created successfully.",
      data: {
        user: safeUser,
        accessToken,
      },
    });
  } catch (error) {
    logger.error("Registration failed:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });
  }
});

// ─────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
      return;
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
      return;
    }

    const { password: _, ...safeUser } = user;

    // Generate token
    const payload = { userId: user.id, email: user.email, user: safeUser };
    const accessToken = jwt.sign(payload, appConfig.ACCESS_TOKEN_SECRET, {
      expiresIn: appConfig.ACCESS_TOKEN_EXPIRY as jwt.SignOptions["expiresIn"],
    });

    logger.info(`🔐 User logged in: ${user.email}`);

    res.json({
      success: true,
      message: "Login successful.",
      data: {
        user: safeUser,
        accessToken,
      },
    });
  } catch (error) {
    logger.error("Login failed:", error);
    res.status(500).json({
      success: false,
      message: "Login failed. Please try again.",
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Get Profile
// ─────────────────────────────────────────────────────────────
export async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const { password: _, ...safeUser } = user;
    res.json({
      success: true,
      message: "Profile retrieved.",
      data: safeUser,
    });
  } catch (error) {
    logger.error("Get profile failed:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve profile." });
  }
}

// ─────────────────────────────────────────────────────────────
// Update Profile
// ─────────────────────────────────────────────────────────────
export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { firstName, lastName, phoneNumber, businessName, businessType } = req.body;

    const user = await db.user.update({
      where: { id: userId },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phoneNumber && { phoneNumber }),
        ...(businessName && { businessName }),
        ...(businessType && { businessType }),
      },
    });

    const { password: _, ...safeUser } = user;
    res.json({
      success: true,
      message: "Profile updated.",
      data: safeUser,
    });
  } catch (error) {
    logger.error("Update profile failed:", error);
    res.status(500).json({ success: false, message: "Failed to update profile." });
  }
}

// ─────────────────────────────────────────────────────────────
// Delete Account (Google Play Policy Compliance)
// ─────────────────────────────────────────────────────────────
export async function deleteAccount(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    logger.info(`🗑️ User requested account deletion: ${userId}`);

    // Delete user's verifications, notifications, and subscriptions in transaction
    await db.$transaction([
      db.verification.deleteMany({ where: { userId } }),
      db.notification.deleteMany({ where: { userId } }),
      db.subscription.deleteMany({ where: { userId } }),
      db.user.delete({ where: { id: userId } }),
    ]);

    logger.info(`✅ Account and associated data successfully deleted for user ${userId}`);

    res.json({
      success: true,
      message: "Account and associated data deleted successfully.",
    });
  } catch (error) {
    logger.error("Delete account failed:", error);
    res.status(500).json({ success: false, message: "Failed to delete account." });
  }
}

// ─────────────────────────────────────────────────────────────
// Web Account Deletion Request (Google Play URL Compliance)
// ─────────────────────────────────────────────────────────────
export async function webDeleteAccount(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Registered email address and password are required.",
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "No account found matching this email address.",
      });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      res.status(401).json({
        success: false,
        message: "Invalid password. Deletion request denied.",
      });
      return;
    }

    logger.info(`🗑️ Web account deletion executed for user: ${normalizedEmail}`);

    await db.$transaction([
      db.verification.deleteMany({ where: { userId: user.id } }),
      db.notification.deleteMany({ where: { userId: user.id } }),
      db.subscription.deleteMany({ where: { userId: user.id } }),
      db.user.delete({ where: { id: user.id } }),
    ]);

    logger.info(`✅ Account and all associated data permanently deleted for ${normalizedEmail}`);

    res.json({
      success: true,
      message: "Your Geba AI account and all associated data have been permanently deleted.",
    });
  } catch (error) {
    logger.error("Web delete account failed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process account deletion request.",
    });
  }
}



import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "@/src/config/db.js";
import appConfig from "@/src/config/app_configs.js";
import { logger } from "@/src/utils/logger/logger.js";
import type { AuthPayload } from "@/src/middlewares/authenticator.js";
import catchAsync from "@/src/utils/helper/catch_async.js";

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
    const user = await db.user.create({
      data: {
        firstName,
        lastName: lastName || "",
        email,
        password: hashedPassword,
        businessName: businessName || "",
        businessType: businessType || "Other",
      },
    });

    // Generate token
    const payload: AuthPayload = { userId: user.id, email: user.email };
    const accessToken = jwt.sign(payload, appConfig.ACCESS_TOKEN_SECRET, {
      expiresIn: appConfig.ACCESS_TOKEN_EXPIRY as jwt.SignOptions["expiresIn"],
    });

    logger.info(`✅ New user registered: ${user.email}`);

    // Return user (without password)
    const { password: _, ...safeUser } = user;
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

    // Generate token
    const payload: AuthPayload = { userId: user.id, email: user.email };
    const accessToken = jwt.sign(payload, appConfig.ACCESS_TOKEN_SECRET, {
      expiresIn: appConfig.ACCESS_TOKEN_EXPIRY as jwt.SignOptions["expiresIn"],
    });

    logger.info(`🔐 User logged in: ${user.email}`);

    const { password: _, ...safeUser } = user;
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
    const userId = req.user?.userId;
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
    const userId = req.user?.userId;
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



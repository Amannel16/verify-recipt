import appConfig from "@/src/config/app_configs.js";
import { db } from "@/src/config/db.js";
import { ConflictError, UnauthenticatedError } from "@/src/utils/error/custom_error_handler.js";
import { TelegramAuthData, TelegramSignupData, verifyTelegramAuth, verifyTelegramWebAppAuth } from "@/src/utils/helper/telegram-auth.js";
import { logger } from "@/src/utils/logger/logger.js";
import { createId } from "@paralleldrive/cuid2";
import jwt from "jsonwebtoken";


export async function loginWithTelegram(data: TelegramAuthData & { initData?: string }) {
    // 1. Verify the data using the utility
    let verifiedData: any = null;
    if (data.initData) {
        verifiedData = verifyTelegramWebAppAuth(data.initData, process.env.TELEGRAM_TOKEN!);
        if (!verifiedData) {
            throw new UnauthenticatedError("Telegram authentication failed.", "AuthService.loginWithTelegram");
        }
        // Use data from verified initData
        data.id = verifiedData.id.toString();
        data.first_name = verifiedData.first_name;
        data.last_name = verifiedData.last_name;
        data.username = verifiedData.username;
        data.photo_url = verifiedData.photo_url;
    } else {
        const isValid = verifyTelegramAuth(data, process.env.TELEGRAM_TOKEN!);
        if (!isValid) {
            throw new UnauthenticatedError("Invalid Telegram authentication data", "AuthService.loginWithTelegram");
        }
    }

    // 2. Find or create user
    // Telegram ID is passed as 'id' in data, stored as providerId
    let user = await db.user.findUnique({
        where: {
            provider: "TELEGRAM",
            providerId: data.id,
        },
        omit: {
            password: true,
        },
    });

    if (!user) {
        throw new UnauthenticatedError("User account not found.", "AuthService.loginWithTelegram");
    } else {
        // Update photo if changed
        if (data.photo_url && user.photo !== data.photo_url) {
            await db.user.update({
                where: { id: user.id },
                data: { photo: data.photo_url }
            });
            user.photo = data.photo_url;
        }
    }

    // 3. Issue Tokens
    const newRefreshToken = jwt.sign(
        { userId: user.id },
        appConfig.REFRESH_TOKEN_SECRET!,
        {
            expiresIn: appConfig.REFRESH_TOKEN_EXPIRY as jwt.SignOptions["expiresIn"],
        }
    );

    await db.user.update({
        where: { id: user.id },
        data: {
            refreshToken: newRefreshToken,
        },
        omit: {
            password: true,
        },
    });

    const accessToken = jwt.sign({ user: user }, appConfig.ACCESS_TOKEN_SECRET!, {
        expiresIn: appConfig.ACCESS_TOKEN_EXPIRY as jwt.SignOptions["expiresIn"],
    });

    logger.info(`🚀 User logged in with Telegram successfully: ${user.id}`);

    return {
        accessToken,
        user,
    };
}

export async function signupWithTelegram(data: TelegramSignupData & { initData?: string }) {
    // 1. Verify the data using the utility
    let verifiedData: any = null;
    if (data.initData) {
        verifiedData = verifyTelegramWebAppAuth(data.initData, process.env.TELEGRAM_TOKEN!);
        if (!verifiedData) {
            throw new UnauthenticatedError("Telegram authentication failed.", "AuthService.signupWithTelegram");
        }
        // Use data from verified initData
        data.id = verifiedData.id.toString();
        data.first_name = verifiedData.first_name;
        data.last_name = verifiedData.last_name;
        data.username = verifiedData.username;
        data.photo_url = verifiedData.photo_url;
    } else {
        const isValid = verifyTelegramAuth(data, process.env.TELEGRAM_TOKEN!);
        if (!isValid) {
            throw new UnauthenticatedError("Telegram authentication failed.", "AuthService.signupWithTelegram");
        }
    }

    // 2. Find or create user
    // Telegram ID is passed as 'id' in data, stored as providerId
    let user = await db.user.findUnique({
        where: {
            provider: "TELEGRAM",
            providerId: data.id,
        },
        omit: {
            password: true,
        },
    });

    if (!user) {
        // Determine names from Telegram data
        // first_name is required by Telegram
        const firstName = data.first_name;
        const lastName = data.last_name || "";
        // Telegram doesn't provide email. Using a fake placeholder or handling it is necessary.
        // For now, using a placeholder email: {id}@telegram.user
        // OR we could make email optional in schema if logic permits, but User schema likely enforces it.
        const email = `${data.id}@telegram.user.geba-ai.com`;

        user = await db.user.create({
            data: {
                id: createId(),
                email: email, // Placeholder
                firstName,
                lastName,
                role: data.role,
                provider: "TELEGRAM",
                providerId: data.id,
                password: "password", // Dummy password
            },
        });



        // 3. Issue Tokens
        const newRefreshToken = jwt.sign(
            { userId: user.id },
            appConfig.REFRESH_TOKEN_SECRET!,
            {
                expiresIn: appConfig.REFRESH_TOKEN_EXPIRY as jwt.SignOptions["expiresIn"],
            }
        );

        await db.user.update({
            where: { id: user.id },
            data: {
                refreshToken: newRefreshToken,
            },
            omit: {
                password: true,
            },
        });

        const accessToken = jwt.sign({ user: user }, appConfig.ACCESS_TOKEN_SECRET!, {
            expiresIn: appConfig.ACCESS_TOKEN_EXPIRY as jwt.SignOptions["expiresIn"],
        });

        logger.info(`🚀 User signed up with Telegram successfully: ${user.id}`);

        return {
            accessToken,
            user,
        };
    } else {
        throw new ConflictError("User already registered with this Telegram account", "AuthService.signupWithTelegram");
    }
}
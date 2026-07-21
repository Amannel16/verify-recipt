import appConfig from "@/src/config/app_configs.js";
import catchAsync from "@/src/utils/helper/catch_async.js";
import { successResponse } from "@/src/utils/helper/response_helper.js";
import { logger } from "@/src/utils/logger/logger.js";
import { Request, Response } from "express";
import * as authSvc from "./service.js";
export const telegramLogin = catchAsync(async (req: Request, res: Response) => {
    const { id, first_name, last_name, username, photo_url, auth_date, hash, initData } = req.body;
    const { accessToken, user } = await authSvc.loginWithTelegram({ id, first_name, last_name, username, photo_url, auth_date, hash, initData });

    logger.info(`🚀 User logged in with Telegram successfully: ${user.id}`);

    // set cookie
    res.cookie("accessToken", accessToken, appConfig.ACCESS_COOKIE_OPTIONS);

    return successResponse(res, "Logged in with Telegram successfully", {
        user,
        accessToken,
    });
});

export const telegramSignup = catchAsync(async (req: Request, res: Response) => {
    const { id, first_name, last_name, username, photo_url, auth_date, hash, role, initData } = req.body;
    const { accessToken, user } = await authSvc.signupWithTelegram({ id, first_name, last_name, username, photo_url, auth_date, hash, role, initData });

    logger.info(`🚀 Signed up with Telegram successfully: ${user.id}`);

    // set cookie
    res.cookie("accessToken", accessToken, appConfig.ACCESS_COOKIE_OPTIONS);

    return successResponse(res, "Signed up with Telegram successfully", {
        user,
        accessToken,
    });
});
import { Router } from "express";
import { telegramLoginSchema, telegramSignupSchema } from "./schema.js";
import { validate } from "@/src/middlewares/validator.js";
import { telegramLogin, telegramSignup } from "./controller.js";


const authRoutes = Router();

authRoutes.post(
    "/login/telegram",
    validate(telegramLoginSchema),
    telegramLogin
);
authRoutes.post(
    "/signup/telegram",
    validate(telegramSignupSchema),
    telegramSignup
);
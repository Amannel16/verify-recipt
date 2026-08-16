import { Router } from "express";
import { handleTranslate } from "./translation.controller.js";
import { translateRateLimiter } from "../../middlewares/rate-limiter.js";

const translateRouter = Router();

// POST /translate
translateRouter.post("/", translateRateLimiter, handleTranslate);

export default translateRouter;

import { ROLE } from "@prisma/client";
import Joi from "joi";


export const telegramLoginSchema = Joi.object({
    body: Joi.object({
        id: Joi.string().required(),
        first_name: Joi.string().required(),
        last_name: Joi.string().optional().allow(null, ""),
        username: Joi.string().optional().allow(null, ""),
        photo_url: Joi.string().optional().allow(null, ""),
        auth_date: Joi.number().required(),

        hash: Joi.string().required(),
        initData: Joi.string().optional().allow(null, ""),
    }),
    params: Joi.object().length(0),
    query: Joi.object().length(0),
});

export const telegramSignupSchema = Joi.object({
    body: Joi.object({
        id: Joi.string().required(),
        first_name: Joi.string().required(),
        last_name: Joi.string().optional().allow(null, ""),
        username: Joi.string().optional().allow(null, ""),
        photo_url: Joi.string().optional().allow(null, ""),
        auth_date: Joi.number().required(),
        role: Joi.string().valid(ROLE.CUSTOMER).optional().default(ROLE.CUSTOMER).messages({
            "string.base": "validation.string",
        }),
        hash: Joi.string().required(),
        initData: Joi.string().optional().allow(null, ""),
    }),
    params: Joi.object().length(0),
    query: Joi.object().length(0),
});
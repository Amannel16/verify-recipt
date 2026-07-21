// src/services/telegram.service.ts
import TelegramBot from "node-telegram-bot-api";
import type { InlineKeyboardMarkup } from "node-telegram-bot-api";
import { logger } from "../../utils/logger/logger.js";

const token = process.env.TELEGRAM_TOKEN!;
const channel = process.env.TELEGRAM_CHANNEL!;

if (!token || !channel) {
  throw new Error("TELEGRAM_TOKEN and TELEGRAM_CHANNEL must be set in .env");
}

const bot = new TelegramBot(token, { polling: false });

/**
 * Escape text for Telegram MarkdownV2.
 * Telegram docs: these characters must be escaped:
 *   _ * [ ] ( ) ~ ` > # + - = | { } . !
 * plus backslash itself.
 */
function escapeMdV2(s: string) {
  // ensure string
  const str = String(s);
  return str.replace(/([_*[\]()~`>#+\-=|{}\.!\\])/g, "\\$1");
}

export interface TenderRequirementInput {
  content: string;
  order: number;
}

export interface TenderSpecificationInput {
  content: string;
  order: number;
}


/**
 * Send a direct message to a specific Telegram user (by their providerId/chatId)
 */
export async function sendDirectTelegramMessage(
  chatId: string,
  messageText: string,
  replyMarkup?: InlineKeyboardMarkup,
) {
  try {
    const sentMessage = await bot.sendMessage(chatId, messageText, {
      parse_mode: "MarkdownV2",
      reply_markup: replyMarkup,
    });
    logger.info(
      `🚀 Direct message sent to Telegram user ${chatId} successfully, message ID: ${sentMessage.message_id}`,
    );
    return sentMessage.message_id?.toString();
  } catch (err: any) {
    logger.error(
      "Telegram direct message failed:",
      err?.message ?? err,
      err?.response?.statusCode,
      err?.response?.statusMessage,
    );

    // If parse error from Telegram (bad entities), retry without Markdown formatting
    if (err?.code === "ETELEGRAM" && err?.response?.statusCode === 400) {
      try {
        const fallbackText = messageText.replace(
          /([_*[\]()~`>#+\-=|{}\.!\\])/g,
          "",
        ); // basic strip or just send plain text
        const sent = await bot.sendMessage(chatId, fallbackText, {
          reply_markup: replyMarkup,
        });
        return sent.message_id?.toString();
      } catch (err2) {
        logger.error("Retry without Markdown failed:", err2);
        throw err2;
      }
    }

    throw err;
  }
}


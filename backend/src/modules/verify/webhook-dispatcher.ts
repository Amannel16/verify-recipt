import crypto from "node:crypto";
import { db } from "@/src/config/db.js";
import { logger } from "@/src/utils/logger/logger.js";

export interface WebhookPayload {
  event: "verification.completed" | "verification.suspicious" | "fraud.alert";
  timestamp: string;
  data: {
    verificationId: string;
    status: string;
    confidence: number;
    amount: number | null;
    currency: string;
    transactionId: string | null;
    paymentMethod: string | null;
    senderName: string | null;
    receiverName: string | null;
    isDuplicate: boolean;
    reasons: string[];
    warnings: string[];
  };
}

export async function dispatchWebhooksForUser(
  userId: string,
  payload: WebhookPayload,
): Promise<void> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });

    if (user?.plan !== "ENTERPRISE") return;

    const webhooks = await (db as any).webhook.findMany({
      where: {
        userId,
        isActive: true,
      },
    });

    if (!webhooks || !webhooks.length) return;

    const bodyString = JSON.stringify(payload);

    for (const hook of webhooks) {
      if (hook.events && hook.events.length > 0 && !hook.events.includes(payload.event)) {
        continue;
      }

      // Compute HMAC signature
      const signature = crypto
        .createHmac("sha256", hook.secret)
        .update(bodyString)
        .digest("hex");

      fetch(hook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Geba-Signature": signature,
          "X-Geba-Event": payload.event,
          "User-Agent": "Geba-AI-Webhook/1.0",
        },
        body: bodyString,
      })
        .then((res) => {
          logger.info(
            `📡 Webhook dispatched to ${hook.url} — status: ${res.status}`,
          );
        })
        .catch((err) => {
          logger.error(`❌ Webhook delivery failed to ${hook.url}:`, err);
        });
    }
  } catch (error) {
    logger.error("Error dispatching webhooks:", error);
  }
}

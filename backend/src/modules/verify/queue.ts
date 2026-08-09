import { logger } from "../../utils/logger/logger.js";
import { socketServer } from "../../socket/index.js";
import { EvidenceInput, V2VerificationResult } from "./types.js";

export async function addVerificationJobToQueue(
  userId: string,
  input: EvidenceInput,
  quickMode: boolean = false,
  processFn: (userId: string, input: EvidenceInput, quickMode: boolean) => Promise<V2VerificationResult>,
): Promise<{ jobId: string; status: "PROCESSING" | "COMPLETED"; result?: V2VerificationResult }> {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  logger.info(`📥 Enqueued verification job ${jobId} for user ${userId} (quickMode=${quickMode})`);

  if (quickMode) {
    const result = await processFn(userId, input, true);
    return { jobId, status: "COMPLETED", result };
  }

  // Asynchronous execution
  setImmediate(async () => {
    try {
      logger.info(`⚙️ Processing async verification job ${jobId}...`);
      const result = await processFn(userId, input, false);
      logger.info(`✅ Async job ${jobId} completed. Pushing socket event...`);
      socketServer.emitToUser(userId, "verification_completed", { jobId, result });
    } catch (err: any) {
      logger.error(`❌ Async job ${jobId} failed: ${err.message}`);
      socketServer.emitToUser(userId, "verification_failed", { jobId, error: err.message });
    }
  });

  return { jobId, status: "PROCESSING" };
}

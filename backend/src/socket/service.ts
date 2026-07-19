import SocketCache from "../redis-client/socket.cache.js";
import { logger } from "../utils/logger/logger.js";
import { socketServer } from "./index.js";

export const realTimeServiceEmiter = async (
  userId: string,
  event: string,
  data: any,
) => {
  const io = socketServer.getIO();
  const socketCache = new SocketCache();
  const userSockets = await socketCache.getUserSockets(userId);

  userSockets.forEach((socket: string) => {
    io?.to(socket).emit(event, data);
  });
};

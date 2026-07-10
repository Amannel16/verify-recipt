import { Server } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import { logger } from "../utils/logger/logger.js";
import SocketCache from "../redis/socket.cache.js";
import appConfig from "../config/app_configs.js";
import { User } from "@prisma/client";
import {
  InternalServerError,
  UnauthenticatedError,
} from "../utils/error/custom_error_handler.js";
import { parse } from "cookie";
import jwt from "jsonwebtoken";

declare module "socket.io" {
  interface Socket {
    user?: User;
  }
}

export class SocketServerClass {
  private io: SocketServer | null = null;
  private socketCache: SocketCache;

  constructor() {
    this.socketCache = new SocketCache();
  }

  public initialize(server: Server): SocketServer {
    if (this.io) return this.io;
    this.io = new SocketServer(server, {
      cors: {
        origin: [appConfig.CLIENT_URL, "http://localhost:4000"],
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
      cookie: true,
      path: "/socket.io",
    });

    this.io.use((socket, next) => {
      // logger.warn(socket.handshake.headers);
      const cookieHeader = socket.handshake.headers.cookie;

      if (!cookieHeader) {
        logger.warn(`🤔 No cookie found for connection attempt: ${socket.id}`);
        const err = new Error("Authentication error: No cookie provided.");
        return next(err);
      }

      try {
        const cookies = parse(cookieHeader);
        const accessToken = cookies.accessToken;

        if (!accessToken) {
          logger.warn(
            `🤔 No access token found in cookies for socket: ${socket.id}`,
          );
          return next(new Error("Authentication error: Access token missing."));
        }

        const payload = jwt.verify(
          accessToken,
          appConfig.ACCESS_TOKEN_SECRET!,
        ) as {
          user: User;
        };

        const user = payload.user;
        logger.info(
          `✅ Authenticated user for socket ${socket.id}: ${user.firstName} ${user.lastName}`,
        );

        socket.user = user;

        next();
      } catch (error) {
        logger.error(
          `🚫 JWT verification failed for socket ${socket.id}:`,
          error,
        );
        // Ensure we pass a standard Error object to next() to avoid serialization issues
        return next(new Error("Authentication error: Invalid token."));
      }
    });

    // Log socket server errors instead of throwing to avoid crashing
    // the process or sending opaque "server error" messages to clients.
    this.io.on("error", (error) => {
      logger.error("🚫 Socket server error:", error);
    });

    // Log connection handshake errors returned to clients
    this.io.on("connect_error", (err) => {
      logger.warn(`Socket connect_error: ${err?.message || String(err)}`);
    });

    this.io.on("connection", async (socket: Socket) => {
      logger.info(
        `🔌 Client connected to ESL server: ${socket.id}, User: ${socket.user?.firstName} ${socket.user?.lastName}`,
      );

      if (!socket.user) return socket.disconnect();

      await this.socketCache.addUserSocket(socket.user.id, socket.id);

      socket.on("disconnect", async () => {
        logger.info(
          `🔴 Client disconnected from ESL server: ${socket.id}, User: ${socket.user?.firstName} ${socket.user?.lastName}`,
        );

        if (!socket.user) return;
        await this.socketCache.removeUserSocket(socket.user.id, socket.id);
      });
    });

    return this.io;
  }

  public getIO(): SocketServer {
    if (!this.io) {
      throw new InternalServerError(
        "Socket server not initialized!",
        "SocketServerClass.getIO",
      );
    }
    return this.io;
  }
}

export const socketServer = new SocketServerClass();

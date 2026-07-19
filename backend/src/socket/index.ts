import { Server } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import { logger } from "../utils/logger/logger.js";
import appConfig from "../config/app_configs.js";
import { User } from "@prisma/client";
import {
  InternalServerError,
  UnauthenticatedError,
} from "../utils/error/custom_error_handler.js";
import * as cookie from "cookie";
import jwt from "jsonwebtoken";
import { db } from "../config/db.js";
import SocketCache from "../redis-client/socket.cache.js";

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
        origin: [appConfig.CLIENT_URL, "http://localhost:4000", "*"],
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
      cookie: true,
      path: "/socket.io",
    });

    this.io.use(async (socket, next) => {
      // Try to find access token from handshake auth, authorization headers, or cookies
      let accessToken = socket.handshake.auth?.token;

      if (!accessToken) {
        const authHeader = socket.handshake.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
          accessToken = authHeader.split(" ")[1];
        }
      }

      if (!accessToken) {
        const cookieHeader = socket.handshake.headers.cookie;
        if (cookieHeader) {
          try {
            const cookies = cookie.parseCookie(cookieHeader);
            accessToken = cookies.accessToken;
          } catch (e) {
            // Ignore parsing error
          }
        }
      }

      if (!accessToken) {
        logger.warn(
          `🤔 No access token found for connection attempt: ${socket.id}`,
        );
        return next(new Error("Authentication error: Access token missing."));
      }

      try {
        const payload = jwt.verify(
          accessToken,
          appConfig.ACCESS_TOKEN_SECRET!,
        ) as {
          userId: string;
          email: string;
        };

        const user = await db.user.findUnique({
          where: { id: payload.userId },
        });

        if (!user) {
          logger.warn(`🤔 Socket user not found in DB: ${payload.userId}`);
          return next(new Error("Authentication error: User not found."));
        }

        logger.info(
          `✅ Authenticated user for socket ${socket.id}: ${user.firstName} ${user.lastName}`,
        );

        socket.user = user as any;

        next();
      } catch (error) {
        logger.error(
          `🚫 JWT verification failed for socket ${socket.id}:`,
          error,
        );
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

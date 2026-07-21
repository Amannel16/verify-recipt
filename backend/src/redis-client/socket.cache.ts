import type { RedisClientType } from 'redis';
import { logger } from '../utils/logger/logger.js';
import redisConnection from './redis.connection.js';

class SocketCache {
  private readonly client: RedisClientType;
  private static readonly inMemoryCache = new Map<string, Set<string>>();

  constructor() {
    this.client = redisConnection.getClient();
    this._connectClient();
  }

  private async _connectClient(): Promise<void> {
    if (!this.client.isOpen) {
      try {
        await this.client.connect();
        logger.info('Redis client connected successfully.');
      } catch (error: unknown) {
        // Handled globally in redisConnection
      }
    }
  }

  private _isRedisAvailable(): boolean {
    return this.client.isOpen && this.client.isReady;
  }

  private _getUserSocketsKey(userId: string): string {
    return `userSockets:${userId}`;
  }

  async addUserSocket(userId: string, socketId: string): Promise<void> {
    if (!this._isRedisAvailable()) {
      logger.info(`[Fallback] Adding socket ${socketId} for user ${userId} in memory`);
      if (!SocketCache.inMemoryCache.has(userId)) {
        SocketCache.inMemoryCache.set(userId, new Set());
      }
      SocketCache.inMemoryCache.get(userId)!.add(socketId);
      return;
    }

    try {
      const key = this._getUserSocketsKey(userId);
      await this.client.sAdd(key, socketId);
      await this.client.expire(key, 24 * 60 * 60); // 24 hours
    } catch (error: unknown) {
      logger.error(
        `Gateway Cache addUserSocket error for user ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async removeUserSocket(userId: string, socketId: string): Promise<void> {
    if (!this._isRedisAvailable()) {
      logger.info(`[Fallback] Removing socket ${socketId} for user ${userId} in memory`);
      const userSockets = SocketCache.inMemoryCache.get(userId);
      if (userSockets) {
        userSockets.delete(socketId);
        if (userSockets.size === 0) {
          SocketCache.inMemoryCache.delete(userId);
        }
      }
      return;
    }

    try {
      const key = this._getUserSocketsKey(userId);
      await this.client.sRem(key, socketId);
      logger.info(`Socket ${socketId} removed for user ${userId}`);
      if ((await this.client.sCard(key)) === 0) {
        await this.client.del(key);
      }
    } catch (error: unknown) {
      logger.error(
        `Gateway Cache removeUserSocket error for user ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async getUserSockets(userId: string): Promise<string[]> {
    if (!this._isRedisAvailable()) {
      const userSockets = SocketCache.inMemoryCache.get(userId);
      return userSockets ? Array.from(userSockets) : [];
    }

    try {
      const key = this._getUserSocketsKey(userId);
      const socketIds = await this.client.sMembers(key);
      return socketIds || [];
    } catch (error: unknown) {
      logger.error(
        `Gateway Cache getUserSockets error for user ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }

  async getOnlineUser(): Promise<Array<string>> {
    if (!this._isRedisAvailable()) {
      return Array.from(SocketCache.inMemoryCache.keys());
    }

    try {
      const keys = await this.client.keys('userSockets:*');
      return keys.map((key) => key.split(':')[1]);
    } catch (error: unknown) {
      logger.error(
        `Gateway Cache getOnlineUser error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }

  async disconnectClient(): Promise<void> {
    if (this.client && this.client.isOpen) {
      await this.client.destroy();
      logger.info('Redis client disconnected.');
    }
  }
}

export default SocketCache;

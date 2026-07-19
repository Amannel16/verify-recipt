import type { RedisClientType } from 'redis';
import { logger } from '../utils/logger/logger.js';
import redisConnection from './redis.connection.js';

class SocketCache {
  private readonly client: RedisClientType;

  constructor() {
    this.client = redisConnection.getClient();

    this.client.on('error', (err: Error) =>
      logger.error(`Redis Client Error: ${JSON.stringify(err)}`),
    );

    this._connectClient();
  }

  private async _connectClient(): Promise<void> {
    if (!this.client.isOpen) {
      try {
        await this.client.connect();
        logger.info('Redis client connected successfully.');
      } catch (error: unknown) {
        logger.error(
          `Failed to connect to Redis: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private _getUserSocketsKey(userId: string): string {
    return `userSockets:${userId}`;
  }

  async addUserSocket(userId: string, socketId: string): Promise<void> {
    try {
      await this._connectClient();
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
    try {
      await this._connectClient();
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
    try {
      await this._connectClient();
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
    try {
      await this._connectClient();
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

import { createClient, RedisClientType } from 'redis';
import appConfig from '../config/app_configs.js';
import { logger } from '../utils/logger/logger.js';

class RedisClient {
  private client: RedisClientType;

  constructor() {
    logger.warn(`Connecting to Redis at: ${appConfig.REDIS_URL}`);
    this.client = createClient({
      url: appConfig.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries >= 2) {
            logger.warn('Max Redis connection retries reached. Using in-memory fallback.');
            return false; // Stop reconnecting
          }
          return 1000; // Wait 1 second before retrying
        }
      }
    });

    // Always catch errors to prevent node process from crashing
    this.client.on('error', (error: Error) => {
      logger.debug(`Redis client connection error: ${error.message}`);
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.info('Redis connected!');
    } catch (error: unknown) {
      logger.warn(
        `Initial Redis connection failed: ${error instanceof Error ? error.message : String(error)}. Using in-memory fallback.`
      );
    }
  }

  public getClient(): RedisClientType {
    return this.client;
  }
}

const redisConnection = new RedisClient();

export default redisConnection;

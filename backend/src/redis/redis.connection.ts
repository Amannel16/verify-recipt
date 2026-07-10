import { createClient, RedisClientType } from 'redis';
import appConfig from '../config/app_configs.js';
import { logger } from '../utils/logger/logger.js';

class RedisClient {
  private client: RedisClientType;

  constructor() {
    logger.warn(appConfig.REDIS_URL);
    this.client = createClient({
      url: appConfig.REDIS_URL,
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.info('Redis connected!');
      this.cacheError();
    } catch (error: unknown) {
      logger.error(
        `Gateway Redis connection error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private cacheError(): void {
    this.client.on('error', (error: Error) => {
      logger.error(`Gateway Redis error: ${error.message}`);
    });
  }

  public getClient(): RedisClientType {
    return this.client;
  }
}

const redisConnection = new RedisClient();

export default redisConnection;

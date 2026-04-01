import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CacheEntry {
  value: string;
  expiresAt: number | null;
}

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private memoryStore: Map<string, CacheEntry> = new Map();
  private redisClient: { get: (key: string) => Promise<string | null>; set: (...args: unknown[]) => Promise<unknown>; del: (key: string) => Promise<unknown>; quit: () => Promise<unknown>; connect: () => Promise<void> } | null = null;
  private backend: 'redis' | 'memory' = 'memory';
  private sweepInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.configService.get<string>('redis.url');

    if (redisUrl) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const IORedis = require('ioredis');
        this.redisClient = new IORedis(redisUrl, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 200, 2000)),
          lazyConnect: true,
        });
        await this.redisClient!.connect();
        this.backend = 'redis';
        this.logger.log('Cache service initialised with Redis backend');
        return;
      } catch {
        this.logger.log('Redis not available, falling back to in-memory cache');
        this.redisClient = null;
      }
    }

    this.backend = 'memory';
    this.logger.log('Cache service initialised with in-memory backend');
    this.sweepInterval = setInterval(() => this.sweep(), 60_000);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch { /* ignore */ }
      this.redisClient = null;
    }
    this.memoryStore.clear();
    this.logger.log('Cache service shut down');
  }

  getBackend(): 'redis' | 'memory' {
    return this.backend;
  }

  async set(key: string, value: string, ttl: number = 0): Promise<void> {
    if (this.backend === 'redis' && this.redisClient) {
      try {
        if (ttl > 0) {
          await this.redisClient.set(key, value, 'EX', ttl);
        } else {
          await this.redisClient.set(key, value);
        }
        return;
      } catch (error) {
        this.logger.warn(`Redis SET failed, falling back to memory: ${key}`);
      }
    }

    const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null;
    this.memoryStore.set(key, { value, expiresAt });
  }

  async get(key: string): Promise<string | null> {
    if (this.backend === 'redis' && this.redisClient) {
      try {
        return await this.redisClient.get(key);
      } catch (error) {
        this.logger.warn(`Redis GET failed, falling back to memory: ${key}`);
      }
    }

    const entry = this.memoryStore.get(key);
    if (!entry) return null;

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.memoryStore.delete(key);
      return null;
    }

    return entry.value;
  }

  async del(key: string): Promise<void> {
    if (this.backend === 'redis' && this.redisClient) {
      try {
        await this.redisClient.del(key);
        return;
      } catch (error) {
        this.logger.warn(`Redis DEL failed, falling back to memory: ${key}`);
      }
    }
    this.memoryStore.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryStore) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.memoryStore.delete(key);
      }
    }
  }
}

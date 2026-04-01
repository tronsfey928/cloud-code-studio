import { logger } from '../utils/logger';
import { config } from '../config';

/**
 * Simple cache entry with optional TTL support.
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
}

/**
 * Unified cache interface that supports both in-memory and Redis backends.
 * When a REDIS_URL is provided and the optional `ioredis` package is installed,
 * the service transparently proxies to Redis. Otherwise it falls back to a
 * plain in-memory Map with TTL support.
 */
export class CacheService {
  private memoryStore: Map<string, CacheEntry<string>> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private redisClient: any = null;
  private backend: 'redis' | 'memory' = 'memory';
  private sweepInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Initialise the cache backend.
   * Tries to connect to Redis when REDIS_URL is set and ioredis is installed.
   * Silently falls back to in-memory if either condition is not met.
   */
  async init(): Promise<void> {
    if (config.redisUrl) {
      try {
        // Dynamic import so ioredis stays optional
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const IORedis = require('ioredis');
        this.redisClient = new IORedis(config.redisUrl, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 200, 2000)),
          lazyConnect: true,
        });

        await this.redisClient.connect();
        this.backend = 'redis';
        logger.info('Cache service initialised with Redis backend');
        return;
      } catch {
        logger.info('Redis not available, falling back to in-memory cache');
        this.redisClient = null;
      }
    }

    this.backend = 'memory';
    logger.info('Cache service initialised with in-memory backend');

    // Periodic sweep to evict expired entries (every 60 s)
    this.sweepInterval = setInterval(() => this.sweep(), 60_000);
  }

  /** Return the active backend type. */
  getBackend(): 'redis' | 'memory' {
    return this.backend;
  }

  /**
   * Store a value in the cache.
   * @param key   Cache key
   * @param value String value to store
   * @param ttl   Time-to-live in seconds (0 = no expiry)
   */
  async set(key: string, value: string, ttl = 0): Promise<void> {
    if (this.backend === 'redis' && this.redisClient) {
      try {
        if (ttl > 0) {
          await this.redisClient.set(key, value, 'EX', ttl);
        } else {
          await this.redisClient.set(key, value);
        }
        return;
      } catch (error) {
        logger.warn('Redis SET failed, falling back to memory', { key, error });
      }
    }

    const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null;
    this.memoryStore.set(key, { value, expiresAt });
  }

  /**
   * Retrieve a value from the cache.
   * Returns null when the key does not exist or has expired.
   */
  async get(key: string): Promise<string | null> {
    if (this.backend === 'redis' && this.redisClient) {
      try {
        return await this.redisClient.get(key);
      } catch (error) {
        logger.warn('Redis GET failed, falling back to memory', { key, error });
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

  /** Delete a key from the cache. */
  async del(key: string): Promise<void> {
    if (this.backend === 'redis' && this.redisClient) {
      try {
        await this.redisClient.del(key);
        return;
      } catch (error) {
        logger.warn('Redis DEL failed, falling back to memory', { key, error });
      }
    }

    this.memoryStore.delete(key);
  }

  /** Check whether a key exists. */
  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  /**
   * Gracefully shut down the cache backend.
   */
  async shutdown(): Promise<void> {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }

    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch {
        // Ignore shutdown errors
      }
      this.redisClient = null;
    }

    this.memoryStore.clear();
    logger.info('Cache service shut down');
  }

  /** Remove expired entries from the in-memory store. */
  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryStore) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.memoryStore.delete(key);
      }
    }
  }
}

/** Singleton instance used across the application. */
export const cacheService = new CacheService();

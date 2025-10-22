/**
 * Rate Limiter Service
 * Prevents API spam and abuse of the AI assistant
 */

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxMessageLength: number;
  cooldownPeriodMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number; // milliseconds until next request allowed
}

export interface RateLimitStatus {
  requestsLastMinute: number;
  requestsLastHour: number;
  cooldownRemaining: number;
}

interface RequestRecord {
  timestamp: number;
  messageLength: number;
}

interface RateLimiterPersistedState {
  requestHistory: RequestRecord[];
  lastRequestTime: number;
}

const RATE_LIMIT_STORAGE_KEY = 'umlAgentRateLimiterState';
const RATE_LIMIT_ENDPOINT_DEFAULT = '/api/uml-agent/rate-limit/check';

export type RateLimiterOptions = Partial<RateLimitConfig> & {
  useServerSideLimit?: boolean;
  endpoint?: string;
  persistLocally?: boolean;
};

interface ServerRateLimitResponse extends RateLimitResult {
  status?: RateLimitStatus;
}

export class RateLimiterService {
  private requestHistory: RequestRecord[] = [];
  private lastRequestTime: number = 0;
  private config: RateLimitConfig;
  private storage: Storage | null;
  private persistLocally: boolean;
  private useServerSide: boolean;
  private endpoint: string;
  private lastRemoteStatus: RateLimitStatus | null = null;
  private lastRemoteStatusTimestamp: number = 0;

  constructor(options?: RateLimiterOptions) {
    this.config = {
      maxRequestsPerMinute: options?.maxRequestsPerMinute ?? 10,
      maxRequestsPerHour: options?.maxRequestsPerHour ?? 50,
      maxMessageLength: options?.maxMessageLength ?? 1000,
      cooldownPeriodMs: options?.cooldownPeriodMs ?? 2000, // 2 seconds between requests
    };

    this.useServerSide = options?.useServerSideLimit ?? true;
    this.endpoint = options?.endpoint ?? RATE_LIMIT_ENDPOINT_DEFAULT;
    this.persistLocally = options?.persistLocally ?? true;
    this.storage = RateLimiterService.resolveStorage();

    if (this.persistLocally) {
      this.loadState();
    }
  }

  /**
   * Check if a request is allowed based on rate limits
   */
  async checkRateLimit(messageLength: number): Promise<RateLimitResult> {
    if (messageLength > this.config.maxMessageLength) {
      return {
        allowed: false,
        reason: `Message too long (max ${this.config.maxMessageLength} characters)`,
      };
    }

    if (this.useServerSide && typeof fetch === 'function') {
      const serverResult = await this.tryServerRateLimit(messageLength);
      if (serverResult) {
        if (serverResult.status) {
          this.updateRemoteStatus(serverResult.status, serverResult.allowed, messageLength);
        }
        return {
          allowed: serverResult.allowed,
          reason: serverResult.reason,
          retryAfter: serverResult.retryAfter,
        };
      }
    }

    return this.checkLocalRateLimit(messageLength);
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): RateLimitStatus {
    const now = Date.now();

    if (this.lastRemoteStatus) {
      const elapsed = now - this.lastRemoteStatusTimestamp;
      return {
        requestsLastMinute: this.lastRemoteStatus.requestsLastMinute,
        requestsLastHour: this.lastRemoteStatus.requestsLastHour,
        cooldownRemaining: Math.max(0, this.lastRemoteStatus.cooldownRemaining - elapsed),
      };
    }

    return this.getLocalStatus(now);
  }

  /**
   * Reset rate limiter (for testing or manual override)
   */
  reset(): void {
    this.requestHistory = [];
    this.lastRequestTime = 0;
    this.lastRemoteStatus = null;
    this.lastRemoteStatusTimestamp = 0;

    if (this.persistLocally) {
      this.persistState();
    }

    if (this.useServerSide && typeof fetch === 'function') {
      this.sendServerReset().catch(() => undefined);
    }
  }

  /**
   * Get time until next request is allowed
   */
  getTimeUntilNextRequest(): number {
    const now = Date.now();
    if (this.lastRemoteStatus) {
      const elapsed = now - this.lastRemoteStatusTimestamp;
      return Math.max(0, this.lastRemoteStatus.cooldownRemaining - elapsed);
    }

    return Math.max(0, this.config.cooldownPeriodMs - (now - this.lastRequestTime));
  }

  /**
   * Check if user can send a message right now
   */
  canSendNow(): boolean {
    return this.getTimeUntilNextRequest() <= 0;
  }

  private async tryServerRateLimit(messageLength: number): Promise<ServerRateLimitResponse | null> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ messageLength }),
      });

      const data = await response.json().catch(() => null);
      if (!data || typeof data.allowed !== 'boolean') {
        return null;
      }

      const statusPayload = data.status;
      const status: RateLimitStatus | undefined =
        statusPayload && typeof statusPayload === 'object'
          ? {
              requestsLastMinute: Number(statusPayload.requestsLastMinute) || 0,
              requestsLastHour: Number(statusPayload.requestsLastHour) || 0,
              cooldownRemaining: Number(statusPayload.cooldownRemaining) || 0,
            }
          : undefined;

      return {
        allowed: data.allowed,
        reason: typeof data.reason === 'string' ? data.reason : undefined,
        retryAfter: typeof data.retryAfter === 'number' ? data.retryAfter : undefined,
        status,
      };
    } catch {
      return null;
    }
  }

  private async sendServerReset(): Promise<void> {
    try {
      await fetch(this.endpoint, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
    } catch {
      // Ignore reset errors – mainly used for tests/manual overrides.
    }
  }

  private updateRemoteStatus(status: RateLimitStatus, wasAllowed: boolean, messageLength: number): void {
    const now = Date.now();
    this.lastRemoteStatus = status;
    this.lastRemoteStatusTimestamp = now;

    // Align local cooldown tracking with server feedback
    const normalizedCooldown = Math.min(Math.max(status.cooldownRemaining, 0), this.config.cooldownPeriodMs);
    const timeSinceLastRequest = this.config.cooldownPeriodMs - normalizedCooldown;
    this.lastRequestTime = timeSinceLastRequest > 0 ? now - timeSinceLastRequest : now - this.config.cooldownPeriodMs;

    if (wasAllowed) {
      this.trackLocalRequest(now, messageLength);
    }
  }

  private checkLocalRateLimit(messageLength: number): RateLimitResult {
    const now = Date.now();

    // Check cooldown period (minimum time between requests)
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.config.cooldownPeriodMs) {
      return {
        allowed: false,
        reason: `Please wait ${Math.ceil((this.config.cooldownPeriodMs - timeSinceLastRequest) / 1000)} seconds between requests`,
        retryAfter: this.config.cooldownPeriodMs - timeSinceLastRequest,
      };
    }

    // Clean up old records
    this.cleanupOldRecords(now);

    // Check per-minute limit
    const requestsLastMinute = this.countRequestsInWindow(now, 60 * 1000);
    if (requestsLastMinute >= this.config.maxRequestsPerMinute) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${this.config.maxRequestsPerMinute} requests per minute`,
        retryAfter: 60 * 1000, // Suggest waiting 1 minute
      };
    }

    // Check per-hour limit
    const requestsLastHour = this.countRequestsInWindow(now, 60 * 60 * 1000);
    if (requestsLastHour >= this.config.maxRequestsPerHour) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${this.config.maxRequestsPerHour} requests per hour`,
        retryAfter: 60 * 60 * 1000, // Suggest waiting 1 hour
      };
    }

    // Request is allowed
    this.trackLocalRequest(now, messageLength);

    return { allowed: true };
  }

  private getLocalStatus(now: number): RateLimitStatus {
    this.cleanupOldRecords(now);

    return {
      requestsLastMinute: this.countRequestsInWindow(now, 60 * 1000),
      requestsLastHour: this.countRequestsInWindow(now, 60 * 60 * 1000),
      cooldownRemaining: Math.max(0, this.config.cooldownPeriodMs - (now - this.lastRequestTime)),
    };
  }

  private trackLocalRequest(timestamp: number, messageLength: number): void {
    this.lastRequestTime = timestamp;
    this.requestHistory.push({
      timestamp,
      messageLength,
    });

    if (this.persistLocally) {
      this.persistState();
    }
  }

  /**
   * Count requests within a time window
   */
  private countRequestsInWindow(now: number, windowMs: number): number {
    const cutoff = now - windowMs;
    return this.requestHistory.filter(record => record.timestamp > cutoff).length;
  }

  /**
   * Clean up old request records
   */
  private cleanupOldRecords(now: number, persistAfterCleanup: boolean = true): void {
    // Keep records from the last hour only
    const oneHourAgo = now - (60 * 60 * 1000);
    const originalLength = this.requestHistory.length;
    this.requestHistory = this.requestHistory.filter(
      record => record.timestamp > oneHourAgo
    );

    if (this.persistLocally && persistAfterCleanup && originalLength !== this.requestHistory.length) {
      this.persistState();
    }
  }

  private static resolveStorage(): Storage | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const storage = window.localStorage;
      const testKey = '__umlAgentRateLimiter__';
      storage.setItem(testKey, '1');
      storage.removeItem(testKey);
      return storage;
    } catch {
      return null;
    }
  }

  private loadState(): void {
    if (!this.storage) {
      return;
    }

    try {
      const storedValue = this.storage.getItem(RATE_LIMIT_STORAGE_KEY);
      if (!storedValue) {
        return;
      }

      const parsed: RateLimiterPersistedState = JSON.parse(storedValue);
      if (!Array.isArray(parsed?.requestHistory) || typeof parsed?.lastRequestTime !== 'number') {
        return;
      }

      this.requestHistory = parsed.requestHistory.filter(
        (record): record is RequestRecord =>
          typeof record?.timestamp === 'number' && typeof record?.messageLength === 'number'
      );
      this.lastRequestTime = parsed.lastRequestTime;
      this.cleanupOldRecords(Date.now(), false);
      this.persistState();
    } catch {
      try {
        this.storage.removeItem(RATE_LIMIT_STORAGE_KEY);
      } catch {
        // ignore storage cleanup errors
      }
    }
  }

  private persistState(): void {
    if (!this.storage) {
      return;
    }

    const state: RateLimiterPersistedState = {
      requestHistory: this.requestHistory,
      lastRequestTime: this.lastRequestTime,
    };

    try {
      this.storage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(state));
    } catch {
      this.storage = null;
    }
  }
}

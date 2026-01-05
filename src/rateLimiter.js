/**
 * Rate Limiter Utility
 * Token bucket implementation for MEXC API rate limiting
 */

class RateLimiter {
  /**
   * Creates a rate limiter instance
   * @param {number} maxTokens - Maximum tokens (requests) allowed
   * @param {number} refillRate - Tokens refilled per second
   */
  constructor(maxTokens = 5, refillRate = 5) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
    this.queue = [];
    this.processing = false;
  }

  /**
   * Refills tokens based on elapsed time
   */
  refillTokens() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // Convert to seconds
    const tokensToAdd = elapsed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Attempts to consume a token
   * @param {number} cost - Number of tokens to consume (default: 1)
   * @returns {boolean} True if token was consumed, false if not enough tokens
   */
  tryConsume(cost = 1) {
    this.refillTokens();
    
    if (this.tokens >= cost) {
      this.tokens -= cost;
      return true;
    }
    
    return false;
  }

  /**
   * Waits until enough tokens are available
   * @param {number} cost - Number of tokens needed (default: 1)
   * @returns {Promise<void>}
   */
  async waitForToken(cost = 1) {
    return new Promise((resolve) => {
      const attempt = () => {
        if (this.tryConsume(cost)) {
          resolve();
        } else {
          // Calculate wait time for next token
          const tokensNeeded = cost - this.tokens;
          const waitTime = Math.ceil((tokensNeeded / this.refillRate) * 1000);
          setTimeout(attempt, Math.max(waitTime, 100));
        }
      };
      
      attempt();
    });
  }

  /**
   * Executes a function with rate limiting
   * @param {Function} fn - Async function to execute
   * @param {number} cost - Token cost (default: 1)
   * @returns {Promise<any>} Result of the function
   */
  async execute(fn, cost = 1) {
    await this.waitForToken(cost);
    return await fn();
  }

  /**
   * Gets current token count
   * @returns {number} Available tokens
   */
  getAvailableTokens() {
    this.refillTokens();
    return Math.floor(this.tokens);
  }

  /**
   * Resets the rate limiter
   */
  reset() {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
    this.queue = [];
  }
}

/**
 * MEXC-specific rate limiter with weight-based limiting
 * MEXC uses a weight system where different endpoints have different weights
 */
class MEXCRateLimiter {
  constructor() {
    // MEXC allows ~1200 weight per minute (20 weight per second)
    // We'll be conservative: 15 weight per second
    this.ipLimiter = new RateLimiter(60, 15); // 60 max, 15 per second
    this.uidLimiter = new RateLimiter(100, 20); // 100 max, 20 per second
  }

  /**
   * Waits for rate limit based on endpoint weight
   * @param {string} endpoint - API endpoint name
   * @returns {Promise<void>}
   */
  async wait(endpoint = 'default') {
    // Define weights for different endpoints
    const weights = {
      'klines': 1,
      'depth': 1,
      'ticker': 1,
      'order': 1,
      'account': 10,
      'default': 1
    };

    const weight = weights[endpoint] || weights.default;
    
    // Wait for both IP and UID limits
    await Promise.all([
      this.ipLimiter.waitForToken(weight),
      this.uidLimiter.waitForToken(weight)
    ]);
  }

  /**
   * Executes a MEXC API call with rate limiting
   * @param {Function} fn - Async function to execute
   * @param {string} endpoint - Endpoint name for weight calculation
   * @returns {Promise<any>} Result of the function
   */
  async execute(fn, endpoint = 'default') {
    await this.wait(endpoint);
    return await fn();
  }

  /**
   * Gets current rate limit status
   * @returns {Object} Status of both limiters
   */
  getStatus() {
    return {
      ipTokens: this.ipLimiter.getAvailableTokens(),
      uidTokens: this.uidLimiter.getAvailableTokens(),
      maxIpTokens: this.ipLimiter.maxTokens,
      maxUidTokens: this.uidLimiter.maxTokens
    };
  }

  /**
   * Resets all rate limiters
   */
  reset() {
    this.ipLimiter.reset();
    this.uidLimiter.reset();
  }
}

/**
 * Simple delay-based rate limiter (alternative implementation)
 */
class DelayRateLimiter {
  constructor(requestsPerSecond = 5) {
    this.minDelay = 1000 / requestsPerSecond; // Milliseconds between requests
    this.lastRequest = 0;
  }

  /**
   * Waits until enough time has passed since last request
   * @returns {Promise<void>}
   */
  async wait() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    
    if (timeSinceLastRequest < this.minDelay) {
      const waitTime = this.minDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequest = Date.now();
  }

  /**
   * Executes a function with delay-based rate limiting
   * @param {Function} fn - Async function to execute
   * @returns {Promise<any>} Result of the function
   */
  async execute(fn) {
    await this.wait();
    return await fn();
  }
}

module.exports = {
  RateLimiter,
  MEXCRateLimiter,
  DelayRateLimiter
};

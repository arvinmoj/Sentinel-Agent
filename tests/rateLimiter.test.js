const { RateLimiter, MEXCRateLimiter, DelayRateLimiter } = require('../src/rateLimiter');

describe('Rate Limiter Modules', () => {
  describe('RateLimiter', () => {
    let limiter;

    beforeEach(() => {
      limiter = new RateLimiter(5, 5); // 5 tokens max, 5 per second refill
    });

    test('should initialize with correct values', () => {
      expect(limiter.maxTokens).toBe(5);
      expect(limiter.tokens).toBe(5);
      expect(limiter.refillRate).toBe(5);
    });

    test('should consume tokens', () => {
      const result = limiter.tryConsume(2);
      expect(result).toBe(true);
      expect(limiter.getAvailableTokens()).toBeLessThanOrEqual(3);
    });

    test('should reject when insufficient tokens', () => {
      limiter.tryConsume(5);
      const result = limiter.tryConsume(1);
      expect(result).toBe(false);
    });

    test('should refill tokens over time', async () => {
      limiter.tryConsume(5); // Consume all tokens
      
      await new Promise(resolve => setTimeout(resolve, 1100)); // Wait 1.1 seconds
      
      expect(limiter.getAvailableTokens()).toBeGreaterThan(0);
    });

    test('should wait for tokens', async () => {
      limiter.tryConsume(5);
      
      const start = Date.now();
      await limiter.waitForToken(1);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThan(100); // Should have waited
    });

    test('should execute function with rate limiting', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      const result = await limiter.execute(mockFn, 1);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalled();
    });

    test('should reset correctly', () => {
      limiter.tryConsume(5);
      limiter.reset();
      
      expect(limiter.tokens).toBe(limiter.maxTokens);
    });
  });

  describe('MEXCRateLimiter', () => {
    let limiter;

    beforeEach(() => {
      limiter = new MEXCRateLimiter();
    });

    test('should initialize with IP and UID limiters', () => {
      expect(limiter.ipLimiter).toBeDefined();
      expect(limiter.uidLimiter).toBeDefined();
    });

    test('should wait for rate limit', async () => {
      await expect(limiter.wait('klines')).resolves.not.toThrow();
    });

    test('should execute with endpoint-specific weights', async () => {
      const mockFn = jest.fn().mockResolvedValue('data');
      
      const result = await limiter.execute(mockFn, 'account');
      
      expect(result).toBe('data');
      expect(mockFn).toHaveBeenCalled();
    });

    test('should provide status information', () => {
      const status = limiter.getStatus();
      
      expect(status).toHaveProperty('ipTokens');
      expect(status).toHaveProperty('uidTokens');
      expect(status).toHaveProperty('maxIpTokens');
      expect(status).toHaveProperty('maxUidTokens');
    });

    test('should reset both limiters', () => {
      limiter.reset();
      const status = limiter.getStatus();
      
      expect(status.ipTokens).toBe(status.maxIpTokens);
      expect(status.uidTokens).toBe(status.maxUidTokens);
    });
  });

  describe('DelayRateLimiter', () => {
    let limiter;

    beforeEach(() => {
      limiter = new DelayRateLimiter(10); // 10 requests per second
    });

    test('should enforce minimum delay between requests', async () => {
      const start = Date.now();
      
      await limiter.wait();
      await limiter.wait();
      
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(100); // Should wait at least 100ms
    });

    test('should execute function with delay', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');
      
      const result = await limiter.execute(mockFn);
      
      expect(result).toBe('result');
      expect(mockFn).toHaveBeenCalled();
    });
  });
});

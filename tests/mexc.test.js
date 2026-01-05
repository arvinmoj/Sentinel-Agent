const MEXCClient = require('../src/mexc');

describe('MEXC Client', () => {
  let client;

  beforeEach(() => {
    client = new MEXCClient('test_api_key', 'test_secret_key', 10);
  });

  describe('Constructor', () => {
    test('should initialize with correct values', () => {
      expect(client.apiKey).toBe('test_api_key');
      expect(client.secretKey).toBe('test_secret_key');
      expect(client.leverage).toBe(10);
      expect(client.baseURL).toBe('https://contract.mexc.com');
    });
  });

  describe('generateSignature', () => {
    test('should generate valid HMAC signature', () => {
      const queryString = 'symbol=XRP_USDT&timestamp=1234567890';
      const signature = client.generateSignature(queryString);
      
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBe(64); // SHA256 hex length
    });

    test('should generate consistent signatures', () => {
      const queryString = 'test=value';
      const sig1 = client.generateSignature(queryString);
      const sig2 = client.generateSignature(queryString);
      
      expect(sig1).toBe(sig2);
    });
  });

  describe('buildQueryString', () => {
    test('should build sorted query string', () => {
      const params = { c: '3', a: '1', b: '2' };
      const result = client.buildQueryString(params);
      
      expect(result).toBe('a=1&b=2&c=3');
    });

    test('should URL encode values', () => {
      const params = { symbol: 'XRP_USDT', test: 'hello world' };
      const result = client.buildQueryString(params);
      
      expect(result).toContain('hello%20world');
    });

    test('should handle special characters', () => {
      const params = { test: '(test)' };
      const result = client.buildQueryString(params);
      
      expect(result).toContain('%28test%29');
    });
  });

  describe('convertIntervalToFutures', () => {
    test('should convert spot intervals to futures format', () => {
      expect(client.convertIntervalToFutures('1m')).toBe('Min1');
      expect(client.convertIntervalToFutures('30m')).toBe('Min30');
      expect(client.convertIntervalToFutures('1h')).toBe('Min60');
      expect(client.convertIntervalToFutures('1d')).toBe('Day1');
    });

    test('should return unchanged if already in futures format', () => {
      expect(client.convertIntervalToFutures('Min30')).toBe('Min30');
    });
  });

  describe('placeOrder', () => {
    test('should return error for invalid side', async () => {
      const result = await client.placeOrder('XRP_USDT', 'INVALID', 100);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid side');
    });

    test('should return error when price missing for LIMIT orders', async () => {
      const result = await client.placeOrder('XRP_USDT', 'LONG', 100, 'LIMIT');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Price is required');
    });
  });
});

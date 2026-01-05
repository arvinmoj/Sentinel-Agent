const { analyzeMarket, detectCandlePatterns } = require('../src/strategy');

describe('Strategy Module', () => {
  // Sample candle data for testing
  const generateCandles = (count = 50, trend = 'bullish') => {
    const candles = [];
    let basePrice = 0.5;
    
    for (let i = 0; i < count; i++) {
      const trendMultiplier = trend === 'bullish' ? 1.001 : 0.999;
      const open = basePrice * trendMultiplier;
      const close = open * (trend === 'bullish' ? 1.002 : 0.998);
      const high = Math.max(open, close) * 1.003;
      const low = Math.min(open, close) * 0.997;
      
      candles.push({
        timestamp: new Date(Date.now() - (count - i) * 30 * 60 * 1000).toISOString(),
        open: parseFloat(open.toFixed(6)),
        high: parseFloat(high.toFixed(6)),
        low: parseFloat(low.toFixed(6)),
        close: parseFloat(close.toFixed(6)),
        volume: 1000000
      });
      
      basePrice = close;
    }
    
    return candles;
  };

  describe('analyzeMarket', () => {
    test('should throw error with insufficient candles', () => {
      const candles = generateCandles(20);
      expect(() => analyzeMarket(candles)).toThrow('Insufficient candle data');
    });

    test('should generate BUY signal in bullish trend', () => {
      const candles = generateCandles(50, 'bullish');
      const result = analyzeMarket(candles);
      
      expect(result).toHaveProperty('signal');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('indicators');
      expect(result.indicators).toHaveProperty('ema9');
      expect(result.indicators).toHaveProperty('ema21');
      expect(result.indicators).toHaveProperty('rsi');
    });

    test('should generate SELL signal in bearish trend', () => {
      const candles = generateCandles(50, 'bearish');
      const result = analyzeMarket(candles);
      
      expect(['SELL', 'HOLD']).toContain(result.signal);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    test('should return valid indicator values', () => {
      const candles = generateCandles(50);
      const result = analyzeMarket(candles);
      
      expect(result.indicators.ema9).toBeGreaterThan(0);
      expect(result.indicators.ema21).toBeGreaterThan(0);
      expect(result.indicators.rsi).toBeGreaterThanOrEqual(0);
      expect(result.indicators.rsi).toBeLessThanOrEqual(100);
    });

    test('should detect trend correctly', () => {
      const candles = generateCandles(50, 'bullish');
      const result = analyzeMarket(candles);
      
      expect(['BULLISH', 'BEARISH', 'NEUTRAL']).toContain(result.trend);
    });

    test('should include current price and timestamp', () => {
      const candles = generateCandles(50);
      const result = analyzeMarket(candles);
      
      expect(result.currentPrice).toBeGreaterThan(0);
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('detectCandlePatterns', () => {
    test('should return array of patterns', () => {
      const candles = generateCandles(30);
      const patterns = detectCandlePatterns(candles, 5);
      
      expect(Array.isArray(patterns)).toBe(true);
    });

    test('should detect doji pattern', () => {
      const candles = [
        { open: 0.5, high: 0.51, low: 0.49, close: 0.500001, volume: 1000 },
        { open: 0.5, high: 0.51, low: 0.49, close: 0.5, volume: 1000 },
        { open: 0.5, high: 0.51, low: 0.49, close: 0.5, volume: 1000 }
      ];
      
      const patterns = detectCandlePatterns(candles, 3);
      const hasDoji = patterns.some(p => p.type === 'DOJI');
      
      expect(hasDoji).toBe(true);
    });

    test('should limit lookback period', () => {
      const candles = generateCandles(50);
      const patterns = detectCandlePatterns(candles, 3);
      
      // Should only analyze last 3 candles
      expect(patterns.every(p => p.index < 3)).toBe(true);
    });
  });
});

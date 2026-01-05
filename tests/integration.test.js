const { processForN8N } = require('../src/n8n-entry');
const { analyzeMarket } = require('../src/strategy');
const { calculateDynamicRisk } = require('../src/risk');

describe('Integration Tests', () => {
  const generateTestCandles = (count = 50) => {
    const candles = [];
    let price = 0.5;
    
    for (let i = 0; i < count; i++) {
      price *= (1 + (Math.random() - 0.5) * 0.02);
      candles.push({
        timestamp: new Date(Date.now() - (count - i) * 30 * 60 * 1000).toISOString(),
        open: parseFloat(price.toFixed(6)),
        high: parseFloat((price * 1.01).toFixed(6)),
        low: parseFloat((price * 0.99).toFixed(6)),
        close: parseFloat(price.toFixed(6)),
        volume: 1000000
      });
    }
    
    return candles;
  };

  describe('Strategy + Risk Integration', () => {
    test('should generate complete trade setup', () => {
      const candles = generateTestCandles(50);
      const signal = analyzeMarket(candles);
      
      if (signal.signal !== 'HOLD') {
        const riskParams = calculateDynamicRisk(signal, candles);
        
        expect(riskParams).toHaveProperty('entry');
        expect(riskParams).toHaveProperty('stopLoss');
        expect(riskParams).toHaveProperty('takeProfit');
        expect(riskParams).toHaveProperty('quantity');
      }
    });
  });

  describe('n8n Entry Point', () => {
    test('should process candles and return n8n format', () => {
      const candles = generateTestCandles(50);
      const items = [{ json: { candles } }];
      
      const result = processForN8N(items);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('json');
      expect(result[0].json).toHaveProperty('success');
      expect(result[0].json).toHaveProperty('signal');
      expect(result[0].json).toHaveProperty('indicators');
    });

    test('should handle missing candles gracefully', () => {
      const items = [{ json: {} }];
      const result = processForN8N(items);
      
      expect(result[0].json.success).toBe(false);
      expect(result[0].json).toHaveProperty('error');
    });

    test('should include trade params for actionable signals', () => {
      const candles = generateTestCandles(50);
      // Modify last candles to create strong bullish signal
      for (let i = 45; i < 50; i++) {
        candles[i].close = candles[i].close * 1.02;
      }
      
      const items = [{ json: { candles } }];
      const result = processForN8N(items);
      
      if (result[0].json.signal !== 'HOLD') {
        expect(result[0].json).toHaveProperty('tradeParams');
        expect(result[0].json.tradeParams).toHaveProperty('entry');
      }
    });
  });
});

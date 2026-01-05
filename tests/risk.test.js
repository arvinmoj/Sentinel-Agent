const { calculateDynamicRisk, validateRiskParameters, calculatePositionSize } = require('../src/risk');

describe('Risk Management Module', () => {
  const mockSignal = {
    signal: 'BUY',
    confidence: 75,
    currentPrice: 0.545,
    indicators: { ema9: 0.55, ema21: 0.54, rsi: 60 }
  };

  const mockCandles = Array(10).fill(null).map((_, i) => ({
    open: 0.50 + i * 0.005,
    high: 0.51 + i * 0.005,
    low: 0.49 + i * 0.005,
    close: 0.50 + i * 0.005,
    volume: 1000000,
    timestamp: new Date().toISOString()
  }));

  describe('calculateDynamicRisk', () => {
    test('should throw error with insufficient candles', () => {
      const candles = mockCandles.slice(0, 3);
      expect(() => calculateDynamicRisk(mockSignal, candles)).toThrow('insufficient candle data');
    });

    test('should calculate risk params for BUY signal', () => {
      const result = calculateDynamicRisk(mockSignal, mockCandles);
      
      expect(result.signal).toBe('BUY');
      expect(result.side).toBe('LONG');
      expect(result.entry).toBeGreaterThan(0);
      expect(result.stopLoss).toBeDefined();
      expect(result.takeProfit).toBeDefined();
      expect(result.quantity).toBeGreaterThan(0);
      // For LONG positions, stopLoss should be below entry
      if (result.stopLoss !== null) {
        expect(result.stopLoss).toBeLessThanOrEqual(result.entry);
      }
      // For LONG positions, takeProfit should be above entry
      if (result.takeProfit !== null) {
        expect(result.takeProfit).toBeGreaterThanOrEqual(result.entry);
      }
    });

    test('should calculate risk params for SELL signal', () => {
      const sellSignal = { ...mockSignal, signal: 'SELL' };
      const result = calculateDynamicRisk(sellSignal, mockCandles);
      
      expect(result.signal).toBe('SELL');
      expect(result.side).toBe('SHORT');
      expect(result.stopLoss).toBeDefined();
      expect(result.takeProfit).toBeDefined();
      // For SHORT positions, stopLoss should be above entry
      if (result.stopLoss !== null) {
        expect(result.stopLoss).toBeGreaterThanOrEqual(result.entry);
      }
      // For SHORT positions, takeProfit should be below entry
      if (result.takeProfit !== null) {
        expect(result.takeProfit).toBeLessThanOrEqual(result.entry);
      }
    });

    test('should return null values for HOLD signal', () => {
      const holdSignal = { ...mockSignal, signal: 'HOLD' };
      const result = calculateDynamicRisk(holdSignal, mockCandles);
      
      expect(result.signal).toBe('HOLD');
      expect(result.side).toBeNull();
      expect(result.stopLoss).toBeNull();
      expect(result.takeProfit).toBeNull();
    });

    test('should respect 1:2 risk/reward ratio', () => {
      const result = calculateDynamicRisk(mockSignal, mockCandles);
      
      expect(result.riskRewardRatio).toBeCloseTo(2, 1);
    });

    test('should calculate correct position size with leverage', () => {
      const result = calculateDynamicRisk(mockSignal, mockCandles, null, 100);
      
      expect(result.positionSizeUSDT).toBe(100);
      expect(result.leverage).toBe(10);
      expect(result.notionalValue).toBe(1000);
      expect(result.marginRequired).toBe(100);
    });

    test('should use custom entry price when provided', () => {
      const customEntry = 0.55;
      const result = calculateDynamicRisk(mockSignal, mockCandles, customEntry);
      
      expect(result.entry).toBe(customEntry);
    });
  });

  describe('validateRiskParameters', () => {
    const mockRiskParams = {
      riskRewardRatio: 2,
      stopLossPercent: 3,
      riskAmount: 50,
      positionSizeUSDT: 100
    };

    test('should validate good risk parameters', () => {
      const result = validateRiskParameters(mockRiskParams);
      
      expect(result.valid).toBe(true);
      expect(Array.isArray(result.reasons)).toBe(true);
    });

    test('should reject low risk/reward ratio', () => {
      const params = { ...mockRiskParams, riskRewardRatio: 1 };
      const result = validateRiskParameters(params, { minRRRatio: 1.5 });
      
      expect(result.valid).toBe(false);
      expect(result.reasons.some(r => r.includes('Risk/Reward'))).toBe(true);
    });

    test('should reject excessive stop loss', () => {
      const params = { ...mockRiskParams, stopLossPercent: 10 };
      const result = validateRiskParameters(params, { maxStopLossPercent: 5 });
      
      expect(result.valid).toBe(false);
      expect(result.reasons.some(r => r.includes('Stop loss distance'))).toBe(true);
    });

    test('should calculate risk percent', () => {
      const result = validateRiskParameters(mockRiskParams);
      
      expect(result.riskPercent).toBeDefined();
      expect(typeof result.riskPercent).toBe('number');
    });
  });

  describe('calculatePositionSize', () => {
    test('should calculate position size correctly', () => {
      const result = calculatePositionSize(5000, 1, 0.5, 0.48);
      
      expect(result.riskAmount).toBe(50); // 1% of 5000
      expect(result.quantity).toBeGreaterThan(0);
      expect(result.positionSize).toBeGreaterThan(0);
    });

    test('should handle invalid inputs gracefully', () => {
      const result = calculatePositionSize(0, 1, 0.5, 0.48);
      // If balance is 0, risk amount should be 0
      expect(result.riskAmount).toBe(0);
    });
  });
});

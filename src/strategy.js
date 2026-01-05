const { EMA, RSI } = require('technicalindicators');

/**
 * Analyzes market data using EMA and RSI indicators
 * @param {Array} candles - Array of OHLCV candles [{open, high, low, close, volume, timestamp}]
 * @returns {Object} Signal object with trading recommendation
 */
function analyzeMarket(candles) {
  try {
    // Validate input
    if (!candles || candles.length < 21) {
      throw new Error('Insufficient candle data. Need at least 21 candles for EMA(21) calculation.');
    }

    // Extract close prices for indicator calculations
    const closePrices = candles.map(c => parseFloat(c.close));
    
    // Calculate EMA(9) and EMA(21)
    const ema9Values = EMA.calculate({
      period: 9,
      values: closePrices
    });
    
    const ema21Values = EMA.calculate({
      period: 21,
      values: closePrices
    });
    
    // Calculate RSI(14)
    const rsiValues = RSI.calculate({
      period: 14,
      values: closePrices
    });
    
    // Get the most recent indicator values
    const currentEMA9 = ema9Values[ema9Values.length - 1];
    const currentEMA21 = ema21Values[ema21Values.length - 1];
    const currentRSI = rsiValues[rsiValues.length - 1];
    
    // Previous values for trend detection
    const previousEMA9 = ema9Values[ema9Values.length - 2];
    const previousEMA21 = ema21Values[ema21Values.length - 2];
    
    // Determine trend direction
    let trend = 'NEUTRAL';
    if (currentEMA9 > currentEMA21) {
      trend = 'BULLISH';
    } else if (currentEMA9 < currentEMA21) {
      trend = 'BEARISH';
    }
    
    // Detect crossovers
    const bullishCrossover = previousEMA9 <= previousEMA21 && currentEMA9 > currentEMA21;
    const bearishCrossover = previousEMA9 >= previousEMA21 && currentEMA9 < currentEMA21;
    
    // Generate trading signal based on refined logic
    let signal = 'HOLD';
    let confidence = 0;
    
    // BUY Signal: EMA9 > EMA21 AND RSI > 50 AND RSI < 70 (exclude overbought)
    if (currentEMA9 > currentEMA21 && currentRSI > 50 && currentRSI < 70) {
      signal = 'BUY';
      confidence = calculateConfidence(currentEMA9, currentEMA21, currentRSI, 'BUY', bullishCrossover);
    }
    // SELL Signal: EMA9 < EMA21 AND RSI < 50 AND RSI > 30 (exclude oversold for entries)
    else if (currentEMA9 < currentEMA21 && currentRSI < 50 && currentRSI > 30) {
      signal = 'SELL';
      confidence = calculateConfidence(currentEMA9, currentEMA21, currentRSI, 'SELL', bearishCrossover);
    }
    
    // Get latest candle for current price
    const latestCandle = candles[candles.length - 1];
    
    return {
      signal,
      confidence,
      indicators: {
        ema9: parseFloat(currentEMA9.toFixed(6)),
        ema21: parseFloat(currentEMA21.toFixed(6)),
        rsi: parseFloat(currentRSI.toFixed(2))
      },
      trend,
      crossover: {
        bullish: bullishCrossover,
        bearish: bearishCrossover
      },
      currentPrice: parseFloat(latestCandle.close),
      timestamp: latestCandle.timestamp || new Date().toISOString(),
      candles: {
        analyzed: candles.length,
        latest: latestCandle
      }
    };
    
  } catch (error) {
    console.error('Error in analyzeMarket:', error.message);
    throw error;
  }
}

/**
 * Calculates confidence score for the signal (0-100)
 * @param {number} ema9 - Current EMA9 value
 * @param {number} ema21 - Current EMA21 value
 * @param {number} rsi - Current RSI value
 * @param {string} signalType - 'BUY' or 'SELL'
 * @param {boolean} crossover - Whether a crossover occurred
 * @returns {number} Confidence score 0-100
 */
function calculateConfidence(ema9, ema21, rsi, signalType, crossover) {
  let confidence = 50; // Base confidence
  
  if (signalType === 'BUY') {
    // Increase confidence based on EMA separation (stronger trend)
    const emaSeparation = ((ema9 - ema21) / ema21) * 100;
    confidence += Math.min(emaSeparation * 10, 20);
    
    // Optimal RSI range (55-65 is ideal for buy)
    if (rsi >= 55 && rsi <= 65) {
      confidence += 15;
    } else {
      confidence += 5;
    }
    
    // Crossover bonus
    if (crossover) {
      confidence += 15;
    }
  } else if (signalType === 'SELL') {
    // Increase confidence based on EMA separation (stronger downtrend)
    const emaSeparation = ((ema21 - ema9) / ema21) * 100;
    confidence += Math.min(emaSeparation * 10, 20);
    
    // Optimal RSI range (35-45 is ideal for sell)
    if (rsi >= 35 && rsi <= 45) {
      confidence += 15;
    } else {
      confidence += 5;
    }
    
    // Crossover bonus
    if (crossover) {
      confidence += 15;
    }
  }
  
  return Math.min(Math.round(confidence), 100);
}

/**
 * Detects candlestick patterns (basic implementation)
 * @param {Array} candles - Array of OHLCV candles
 * @param {number} lookback - Number of candles to analyze (default: 3)
 * @returns {Array} Detected patterns
 */
function detectCandlePatterns(candles, lookback = 3) {
  const patterns = [];
  const recentCandles = candles.slice(-lookback);
  
  recentCandles.forEach((candle, index) => {
    const open = parseFloat(candle.open);
    const close = parseFloat(candle.close);
    const high = parseFloat(candle.high);
    const low = parseFloat(candle.low);
    const body = Math.abs(close - open);
    const range = high - low;
    
    // Doji: Very small body relative to range
    if (body / range < 0.1 && range > 0) {
      patterns.push({ type: 'DOJI', strength: 'MEDIUM', index });
    }
    
    // Hammer/Hanging Man: Small body at top, long lower wick
    const lowerWick = Math.min(open, close) - low;
    const upperWick = high - Math.max(open, close);
    if (lowerWick > body * 2 && upperWick < body * 0.3) {
      patterns.push({ type: close > open ? 'HAMMER' : 'HANGING_MAN', strength: 'HIGH', index });
    }
    
    // Shooting Star: Small body at bottom, long upper wick
    if (upperWick > body * 2 && lowerWick < body * 0.3) {
      patterns.push({ type: 'SHOOTING_STAR', strength: 'HIGH', index });
    }
  });
  
  return patterns;
}

module.exports = {
  analyzeMarket,
  detectCandlePatterns
};

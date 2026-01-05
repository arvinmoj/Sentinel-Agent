/**
 * n8n Code Node Entry Point
 * This module is designed to be used directly in n8n Code nodes
 * It imports strategy and risk modules and formats output for n8n workflows
 */

// Import required modules
const { analyzeMarket, detectCandlePatterns } = require('./strategy');
const { calculateDynamicRisk, validateRiskParameters } = require('./risk');

/**
 * Main function for n8n Code Node
 * This function should be called with candles data from previous n8n node
 * 
 * Expected input format from n8n:
 * [
 *   {
 *     json: {
 *       candles: [{open, high, low, close, volume, timestamp}, ...]
 *     }
 *   }
 * ]
 * 
 * @param {Array} items - n8n input items
 * @returns {Array} n8n formatted output
 */
function processForN8N(items) {
  try {
    // Extract candles from n8n input
    const inputData = items[0].json;
    const candles = inputData.candles || inputData.klines || inputData;

    if (!Array.isArray(candles) || candles.length === 0) {
      return [{
        json: {
          error: 'No candles data provided',
          success: false,
          timestamp: new Date().toISOString()
        }
      }];
    }

    // Analyze market using strategy module
    const signal = analyzeMarket(candles);

    // Detect candle patterns
    const patterns = detectCandlePatterns(candles, 3);

    // Calculate risk parameters if signal is not HOLD
    let riskParams = null;
    let riskValidation = null;

    if (signal.signal !== 'HOLD') {
      riskParams = calculateDynamicRisk(signal, candles);
      riskValidation = validateRiskParameters(riskParams);
    }

    // Format output for n8n
    return [{
      json: {
        success: true,
        signal: signal.signal,
        confidence: signal.confidence,
        timestamp: signal.timestamp,
        
        // Technical indicators
        indicators: signal.indicators,
        trend: signal.trend,
        crossover: signal.crossover,
        currentPrice: signal.currentPrice,
        
        // Candle patterns
        patterns: patterns,
        
        // Trade parameters (if signal is BUY or SELL)
        tradeParams: riskParams ? {
          side: riskParams.side,
          entry: riskParams.entry,
          stopLoss: riskParams.stopLoss,
          takeProfit: riskParams.takeProfit,
          quantity: riskParams.quantity,
          positionSizeUSDT: riskParams.positionSizeUSDT,
          riskRewardRatio: riskParams.riskRewardRatio,
          riskAmount: riskParams.riskAmount,
          potentialProfit: riskParams.potentialProfit,
          stopLossPercent: riskParams.stopLossPercent,
          takeProfitPercent: riskParams.takeProfitPercent
        } : null,
        
        // Risk validation
        riskValidation: riskValidation,
        
        // Market context for Dify
        marketContext: {
          trend: signal.trend,
          rsi: signal.indicators.rsi,
          ema9: signal.indicators.ema9,
          ema21: signal.indicators.ema21,
          candlePatterns: patterns.map(p => p.type).join(', ') || 'None detected',
          signal: signal.signal,
          confidence: signal.confidence
        },
        
        // Analysis metadata
        analysis: {
          candlesAnalyzed: candles.length,
          latestCandleTime: candles[candles.length - 1].timestamp,
          analysisTime: new Date().toISOString()
        }
      }
    }];

  } catch (error) {
    console.error('Error in n8n processing:', error);
    
    return [{
      json: {
        success: false,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }
    }];
  }
}

/**
 * Standalone execution handler for testing
 * This allows the script to be run directly with Node.js for testing
 */
function standalone() {
  // Sample test data
  const testCandles = [];
  const basePrice = 0.5;
  
  // Generate 50 sample candles with trend
  for (let i = 0; i < 50; i++) {
    const trend = i * 0.001; // Uptrend
    const volatility = 0.002;
    
    const open = basePrice + trend + (Math.random() - 0.5) * volatility;
    const close = open + (Math.random() - 0.5) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility;
    const low = Math.min(open, close) - Math.random() * volatility;
    
    testCandles.push({
      timestamp: new Date(Date.now() - (50 - i) * 30 * 60 * 1000).toISOString(),
      open: parseFloat(open.toFixed(6)),
      high: parseFloat(high.toFixed(6)),
      low: parseFloat(low.toFixed(6)),
      close: parseFloat(close.toFixed(6)),
      volume: Math.random() * 1000000
    });
  }

  // Process with test data
  const items = [{ json: { candles: testCandles } }];
  const result = processForN8N(items);
  
  console.log('=== n8n Entry Point Test ===');
  console.log(JSON.stringify(result, null, 2));
  
  return result;
}

// Check if running standalone
if (require.main === module) {
  standalone();
}

module.exports = {
  processForN8N,
  standalone
};

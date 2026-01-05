/**
 * Risk Management Module
 * Calculates dynamic stop-loss, take-profit, and position sizing
 */

/**
 * Calculates dynamic risk parameters for a trade
 * @param {Object} signal - Signal object from strategy.analyzeMarket()
 * @param {Array} candles - Array of OHLCV candles
 * @param {number} entryPrice - Intended entry price (default: current price from signal)
 * @param {number} positionSizeUSDT - Position size in USDT (default: 100)
 * @returns {Object} Risk parameters including stop-loss, take-profit, and quantity
 */
function calculateDynamicRisk(signal, candles, entryPrice = null, positionSizeUSDT = 100) {
  try {
    // Validate inputs
    if (!signal || !candles || candles.length < 5) {
      throw new Error('Invalid signal or insufficient candle data (need at least 5 candles)');
    }

    // Use signal's current price if entry price not provided
    const entry = entryPrice || signal.currentPrice;
    if (!entry || entry <= 0) {
      throw new Error('Invalid entry price');
    }

    // Get last 5 candles for dynamic stop-loss calculation
    const last5Candles = candles.slice(-5);
    const lows = last5Candles.map(c => parseFloat(c.low));
    const highs = last5Candles.map(c => parseFloat(c.high));

    let stopLoss, takeProfit, side;
    const bufferPercent = 0.005; // 0.5% buffer

    if (signal.signal === 'BUY') {
      side = 'LONG';
      
      // Stop Loss: Minimum of last 5 candle lows - 0.5% buffer
      const minLow = Math.min(...lows);
      stopLoss = minLow * (1 - bufferPercent);
      
      // Calculate risk distance
      const riskDistance = entry - stopLoss;
      
      // Take Profit: 1:2 Risk/Reward ratio
      takeProfit = entry + (riskDistance * 2);
      
    } else if (signal.signal === 'SELL') {
      side = 'SHORT';
      
      // Stop Loss: Maximum of last 5 candle highs + 0.5% buffer
      const maxHigh = Math.max(...highs);
      stopLoss = maxHigh * (1 + bufferPercent);
      
      // Calculate risk distance
      const riskDistance = stopLoss - entry;
      
      // Take Profit: 1:2 Risk/Reward ratio
      takeProfit = entry - (riskDistance * 2);
      
    } else {
      // HOLD signal - no trade parameters
      return {
        signal: 'HOLD',
        side: null,
        entry: entry,
        stopLoss: null,
        takeProfit: null,
        quantity: 0,
        positionSizeUSDT: 0,
        riskRewardRatio: 0,
        riskAmount: 0,
        potentialProfit: 0
      };
    }

    // Calculate position size (quantity of XRP for 100 USDT)
    const quantity = positionSizeUSDT / entry;

    // Calculate risk and profit in USDT
    const riskPerUnit = Math.abs(entry - stopLoss);
    const profitPerUnit = Math.abs(takeProfit - entry);
    const riskAmount = riskPerUnit * quantity;
    const potentialProfit = profitPerUnit * quantity;
    const riskRewardRatio = profitPerUnit / riskPerUnit;

    return {
      signal: signal.signal,
      side,
      entry: parseFloat(entry.toFixed(6)),
      stopLoss: parseFloat(stopLoss.toFixed(6)),
      takeProfit: parseFloat(takeProfit.toFixed(6)),
      quantity: parseFloat(quantity.toFixed(4)),
      positionSizeUSDT,
      riskRewardRatio: parseFloat(riskRewardRatio.toFixed(2)),
      riskAmount: parseFloat(riskAmount.toFixed(2)),
      potentialProfit: parseFloat(potentialProfit.toFixed(2)),
      stopLossPercent: parseFloat((Math.abs(entry - stopLoss) / entry * 100).toFixed(2)),
      takeProfitPercent: parseFloat((Math.abs(takeProfit - entry) / entry * 100).toFixed(2))
    };

  } catch (error) {
    console.error('Error in calculateDynamicRisk:', error.message);
    throw error;
  }
}

/**
 * Validates if risk parameters are within acceptable limits
 * @param {Object} riskParams - Risk parameters from calculateDynamicRisk()
 * @param {Object} limits - Risk limits {maxRiskPercent, minRRRatio, maxStopLossPercent}
 * @returns {Object} Validation result {valid, reasons}
 */
function validateRiskParameters(riskParams, limits = {}) {
  const {
    maxRiskPercent = 2, // Max 2% risk per trade
    minRRRatio = 1.5,   // Minimum 1:1.5 risk/reward
    maxStopLossPercent = 5 // Max 5% stop loss distance
  } = limits;

  const reasons = [];
  let valid = true;

  // Check risk/reward ratio
  if (riskParams.riskRewardRatio < minRRRatio) {
    valid = false;
    reasons.push(`Risk/Reward ratio ${riskParams.riskRewardRatio} is below minimum ${minRRRatio}`);
  }

  // Check stop loss distance
  if (riskParams.stopLossPercent > maxStopLossPercent) {
    valid = false;
    reasons.push(`Stop loss distance ${riskParams.stopLossPercent}% exceeds maximum ${maxStopLossPercent}%`);
  }

  // Check if risk amount is reasonable (assuming 5000 USDT account size)
  const accountSize = 5000; // TODO: Make this configurable
  const riskPercent = (riskParams.riskAmount / accountSize) * 100;
  if (riskPercent > maxRiskPercent) {
    valid = false;
    reasons.push(`Risk ${riskPercent.toFixed(2)}% exceeds maximum ${maxRiskPercent}% of account`);
  }

  return {
    valid,
    reasons: reasons.length > 0 ? reasons : ['All risk parameters within acceptable limits'],
    riskPercent: parseFloat(riskPercent.toFixed(2))
  };
}

/**
 * Calculates position size based on percentage risk model
 * @param {number} accountBalance - Total account balance in USDT
 * @param {number} riskPercent - Percentage of account to risk (e.g., 1 = 1%)
 * @param {number} entryPrice - Entry price
 * @param {number} stopLossPrice - Stop loss price
 * @returns {Object} Position sizing details
 */
function calculatePositionSize(accountBalance, riskPercent, entryPrice, stopLossPrice) {
  try {
    // Amount willing to risk in USDT
    const riskAmount = (accountBalance * riskPercent) / 100;
    
    // Risk per unit
    const riskPerUnit = Math.abs(entryPrice - stopLossPrice);
    
    // Calculate quantity
    const quantity = riskAmount / riskPerUnit;
    
    // Position size in USDT
    const positionSize = quantity * entryPrice;
    
    return {
      quantity: parseFloat(quantity.toFixed(4)),
      positionSize: parseFloat(positionSize.toFixed(2)),
      riskAmount: parseFloat(riskAmount.toFixed(2)),
      riskPerUnit: parseFloat(riskPerUnit.toFixed(6))
    };
  } catch (error) {
    console.error('Error in calculatePositionSize:', error.message);
    throw error;
  }
}

module.exports = {
  calculateDynamicRisk,
  validateRiskParameters,
  calculatePositionSize
};

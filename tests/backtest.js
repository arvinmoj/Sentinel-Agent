/**
 * Backtest Script for Trading Strategy
 * Tests strategy performance against historical OHLCV data
 */

const fs = require('fs');
const path = require('path');
const { analyzeMarket, detectCandlePatterns } = require('../src/strategy');
const { calculateDynamicRisk, validateRiskParameters } = require('../src/risk');

// Configuration
const CONFIG = {
  initialBalance: 5000, // Starting balance in USDT
  positionSizeUSDT: 100, // Fixed position size
  commission: 0.1, // 0.1% per trade
  slippage: 0.05, // 0.05% slippage
  dataPath: './tests/data/historical.json'
};

// Trade tracking
let balance = CONFIG.initialBalance;
let trades = [];
let openPosition = null;
let stats = {
  totalTrades: 0,
  wins: 0,
  losses: 0,
  breakeven: 0,
  totalProfit: 0,
  totalLoss: 0,
  maxDrawdown: 0,
  peakBalance: CONFIG.initialBalance,
  consecutiveWins: 0,
  consecutiveLosses: 0,
  maxConsecutiveWins: 0,
  maxConsecutiveLosses: 0
};

/**
 * Loads historical candle data from file or generates sample data
 * @returns {Array} Array of OHLCV candles
 */
function loadHistoricalData() {
  try {
    // Try to load from file
    if (fs.existsSync(CONFIG.dataPath)) {
      const data = JSON.parse(fs.readFileSync(CONFIG.dataPath, 'utf8'));
      console.log(`✓ Loaded ${data.length} candles from ${CONFIG.dataPath}`);
      return data;
    }
  } catch (error) {
    console.log(`⚠ Could not load data from ${CONFIG.dataPath}: ${error.message}`);
  }

  // Generate sample data if file doesn't exist
  console.log('⚠ Generating sample historical data (200 candles)...');
  return generateSampleData(200);
}

/**
 * Generates sample OHLCV data for testing
 * @param {number} count - Number of candles to generate
 * @returns {Array} Sample candles
 */
function generateSampleData(count) {
  const candles = [];
  let basePrice = 0.5; // Starting XRP price
  const volatility = 0.02;
  const trendStrength = 0.0003;

  for (let i = 0; i < count; i++) {
    // Add trend (alternating every 50 candles)
    const trendDirection = Math.floor(i / 50) % 2 === 0 ? 1 : -1;
    const trend = trendDirection * trendStrength * (i % 50);
    
    // Random walk with trend
    const change = (Math.random() - 0.5) * volatility;
    const open = basePrice + trend;
    const close = open + change;
    const high = Math.max(open, close) * (1 + Math.random() * volatility / 2);
    const low = Math.min(open, close) * (1 - Math.random() * volatility / 2);
    
    candles.push({
      timestamp: new Date(Date.now() - (count - i) * 30 * 60 * 1000).toISOString(),
      timestampMs: Date.now() - (count - i) * 30 * 60 * 1000,
      open: parseFloat(open.toFixed(6)),
      high: parseFloat(high.toFixed(6)),
      low: parseFloat(low.toFixed(6)),
      close: parseFloat(close.toFixed(6)),
      volume: Math.random() * 1000000
    });
    
    basePrice = close;
  }

  return candles;
}

/**
 * Simulates opening a position
 * @param {Object} signal - Signal from strategy
 * @param {Object} riskParams - Risk parameters
 * @param {number} index - Current candle index
 */
function openTrade(signal, riskParams, index) {
  const commission = (CONFIG.positionSizeUSDT * CONFIG.commission) / 100;
  const slippage = (CONFIG.positionSizeUSDT * CONFIG.slippage) / 100;
  const totalCost = commission + slippage;

  openPosition = {
    signal: signal.signal,
    entry: riskParams.entry,
    stopLoss: riskParams.stopLoss,
    takeProfit: riskParams.takeProfit,
    quantity: riskParams.quantity,
    positionSize: CONFIG.positionSizeUSDT,
    entryIndex: index,
    entryTime: signal.timestamp,
    cost: totalCost
  };

  balance -= totalCost;
  console.log(`\n📈 OPEN ${signal.signal}: Entry ${riskParams.entry} | SL ${riskParams.stopLoss} | TP ${riskParams.takeProfit}`);
}

/**
 * Checks if position should be closed and closes it
 * @param {Object} candle - Current candle
 * @param {number} index - Current candle index
 * @returns {boolean} True if position was closed
 */
function checkAndClosePosition(candle, index) {
  if (!openPosition) return false;

  let closePrice = null;
  let closeReason = null;

  // Check stop loss
  if (openPosition.signal === 'BUY' && candle.low <= openPosition.stopLoss) {
    closePrice = openPosition.stopLoss;
    closeReason = 'STOP_LOSS';
  } else if (openPosition.signal === 'SELL' && candle.high >= openPosition.stopLoss) {
    closePrice = openPosition.stopLoss;
    closeReason = 'STOP_LOSS';
  }
  
  // Check take profit
  if (openPosition.signal === 'BUY' && candle.high >= openPosition.takeProfit) {
    closePrice = openPosition.takeProfit;
    closeReason = 'TAKE_PROFIT';
  } else if (openPosition.signal === 'SELL' && candle.low <= openPosition.takeProfit) {
    closePrice = openPosition.takeProfit;
    closeReason = 'TAKE_PROFIT';
  }

  if (closePrice) {
    closeTrade(closePrice, closeReason, candle, index);
    return true;
  }

  return false;
}

/**
 * Closes an open position and records trade
 * @param {number} exitPrice - Exit price
 * @param {string} reason - Close reason
 * @param {Object} candle - Exit candle
 * @param {number} index - Exit candle index
 */
function closeTrade(exitPrice, reason, candle, index) {
  const commission = (CONFIG.positionSizeUSDT * CONFIG.commission) / 100;
  
  // Calculate P&L
  let pnl;
  if (openPosition.signal === 'BUY') {
    pnl = (exitPrice - openPosition.entry) * openPosition.quantity;
  } else {
    pnl = (openPosition.entry - exitPrice) * openPosition.quantity;
  }
  
  // Deduct exit commission
  pnl -= commission;
  
  // Update balance
  balance += CONFIG.positionSizeUSDT + pnl;
  
  // Record trade
  const trade = {
    ...openPosition,
    exit: exitPrice,
    exitTime: candle.timestamp,
    exitIndex: index,
    reason: reason,
    pnl: parseFloat(pnl.toFixed(2)),
    pnlPercent: parseFloat(((pnl / CONFIG.positionSizeUSDT) * 100).toFixed(2)),
    duration: index - openPosition.entryIndex
  };
  
  trades.push(trade);
  
  // Update stats
  stats.totalTrades++;
  if (pnl > 0) {
    stats.wins++;
    stats.totalProfit += pnl;
    stats.consecutiveWins++;
    stats.consecutiveLosses = 0;
    stats.maxConsecutiveWins = Math.max(stats.maxConsecutiveWins, stats.consecutiveWins);
  } else if (pnl < 0) {
    stats.losses++;
    stats.totalLoss += Math.abs(pnl);
    stats.consecutiveLosses++;
    stats.consecutiveWins = 0;
    stats.maxConsecutiveLosses = Math.max(stats.maxConsecutiveLosses, stats.consecutiveLosses);
  } else {
    stats.breakeven++;
  }
  
  // Track drawdown
  if (balance > stats.peakBalance) {
    stats.peakBalance = balance;
  }
  const drawdown = ((stats.peakBalance - balance) / stats.peakBalance) * 100;
  stats.maxDrawdown = Math.max(stats.maxDrawdown, drawdown);
  
  console.log(`📉 CLOSE ${reason}: Exit ${exitPrice} | P&L: ${pnl > 0 ? '+' : ''}${pnl.toFixed(2)} USDT (${trade.pnlPercent}%) | Balance: ${balance.toFixed(2)}`);
  
  openPosition = null;
}

/**
 * Runs backtest on historical data
 * @param {Array} candles - Historical candle data
 */
function runBacktest(candles) {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 STARTING BACKTEST');
  console.log('='.repeat(60));
  console.log(`Initial Balance: ${CONFIG.initialBalance} USDT`);
  console.log(`Position Size: ${CONFIG.positionSizeUSDT} USDT`);
  console.log(`Total Candles: ${candles.length}`);
  console.log(`Timeframe: 30m`);
  console.log('='.repeat(60));

  // Need at least 21 candles for EMA(21)
  for (let i = 21; i < candles.length; i++) {
    const lookbackCandles = candles.slice(0, i + 1);
    const currentCandle = candles[i];
    
    // Check if we should close existing position
    if (openPosition) {
      checkAndClosePosition(currentCandle, i);
      continue; // Don't open new position while one is open
    }
    
    // Analyze market
    try {
      const signal = analyzeMarket(lookbackCandles);
      
      // Only trade on actionable signals with minimum confidence
      if (signal.signal !== 'HOLD' && signal.confidence >= 60) {
        const riskParams = calculateDynamicRisk(signal, lookbackCandles);
        const validation = validateRiskParameters(riskParams);
        
        // Only open trade if risk validation passes
        if (validation.valid) {
          openTrade(signal, riskParams, i);
        }
      }
    } catch (error) {
      // Silently continue on analysis errors
    }
  }
  
  // Close any remaining open position at final price
  if (openPosition) {
    const finalCandle = candles[candles.length - 1];
    closeTrade(finalCandle.close, 'END_OF_DATA', finalCandle, candles.length - 1);
  }
}

/**
 * Prints backtest results
 */
function printResults() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 BACKTEST RESULTS');
  console.log('='.repeat(60));
  
  console.log('\n💰 FINANCIAL SUMMARY:');
  console.log(`Initial Balance:     ${CONFIG.initialBalance.toFixed(2)} USDT`);
  console.log(`Final Balance:       ${balance.toFixed(2)} USDT`);
  const netProfit = balance - CONFIG.initialBalance;
  console.log(`Net P&L:             ${netProfit > 0 ? '+' : ''}${netProfit.toFixed(2)} USDT (${((netProfit / CONFIG.initialBalance) * 100).toFixed(2)}%)`);
  console.log(`Max Drawdown:        ${stats.maxDrawdown.toFixed(2)}%`);
  
  console.log('\n📈 TRADE STATISTICS:');
  console.log(`Total Trades:        ${stats.totalTrades}`);
  console.log(`Wins:                ${stats.wins} (${stats.totalTrades > 0 ? ((stats.wins / stats.totalTrades) * 100).toFixed(1) : 0}%)`);
  console.log(`Losses:              ${stats.losses} (${stats.totalTrades > 0 ? ((stats.losses / stats.totalTrades) * 100).toFixed(1) : 0}%)`);
  console.log(`Breakeven:           ${stats.breakeven}`);
  
  if (stats.totalTrades > 0) {
    const avgWin = stats.wins > 0 ? stats.totalProfit / stats.wins : 0;
    const avgLoss = stats.losses > 0 ? stats.totalLoss / stats.losses : 0;
    const profitFactor = stats.totalLoss > 0 ? stats.totalProfit / stats.totalLoss : 0;
    const avgPnL = netProfit / stats.totalTrades;
    
    console.log(`Avg Win:             +${avgWin.toFixed(2)} USDT`);
    console.log(`Avg Loss:            -${avgLoss.toFixed(2)} USDT`);
    console.log(`Avg P&L per Trade:   ${avgPnL > 0 ? '+' : ''}${avgPnL.toFixed(2)} USDT`);
    console.log(`Profit Factor:       ${profitFactor.toFixed(2)}`);
    console.log(`Max Consecutive Wins: ${stats.maxConsecutiveWins}`);
    console.log(`Max Consecutive Losses: ${stats.maxConsecutiveLosses}`);
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Show last 5 trades
  if (trades.length > 0) {
    console.log('\n📋 LAST 5 TRADES:');
    const lastTrades = trades.slice(-5);
    lastTrades.forEach((trade, idx) => {
      console.log(`\n${trades.length - (lastTrades.length - idx - 1)}. ${trade.signal} - ${trade.reason}`);
      console.log(`   Entry: ${trade.entry} | Exit: ${trade.exit}`);
      console.log(`   P&L: ${trade.pnl > 0 ? '+' : ''}${trade.pnl} USDT (${trade.pnlPercent}%)`);
      console.log(`   Duration: ${trade.duration} candles (${(trade.duration * 0.5).toFixed(1)} hours)`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
}

/**
 * Main execution
 */
function main() {
  console.log('🤖 Sentinel Agent - Backtest Module\n');
  
  // Load historical data
  const candles = loadHistoricalData();
  
  if (!candles || candles.length < 50) {
    console.error('❌ Insufficient candle data for backtest (need at least 50 candles)');
    process.exit(1);
  }
  
  // Run backtest
  runBacktest(candles);
  
  // Print results
  printResults();
  
  // Save results to file
  const resultsPath = './tests/backtest-results.json';
  const results = {
    config: CONFIG,
    stats,
    finalBalance: balance,
    netProfit: balance - CONFIG.initialBalance,
    trades: trades,
    timestamp: new Date().toISOString()
  };
  
  try {
    fs.mkdirSync('./tests', { recursive: true });
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n✅ Results saved to ${resultsPath}`);
  } catch (error) {
    console.log(`\n⚠ Could not save results: ${error.message}`);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  runBacktest,
  loadHistoricalData,
  generateSampleData
};

require('dotenv').config();

module.exports = {
  // Trading Configuration
  trading: {
    symbol: process.env.TRADING_SYMBOL || 'XRP_USDT',
    interval: process.env.TRADING_INTERVAL || '30m',
    positionSizeUSDT: parseFloat(process.env.POSITION_SIZE_USDT || '100')
  },

  // Risk Management
  risk: {
    stopLossBuffer: parseFloat(process.env.STOP_LOSS_BUFFER || '0.5'), // 0.5%
    riskRewardRatio: parseFloat(process.env.RISK_REWARD_RATIO || '2'), // 1:2
    maxRiskPercent: parseFloat(process.env.MAX_RISK_PERCENT || '2'), // 2% max risk per trade
    minRRRatio: parseFloat(process.env.MIN_RR_RATIO || '1.5'), // Minimum 1:1.5 R/R
    maxStopLossPercent: parseFloat(process.env.MAX_STOP_LOSS_PERCENT || '5') // Max 5% SL distance
  },

  // Strategy Parameters
  strategy: {
    ema: {
      fast: parseInt(process.env.EMA_FAST || '9'),
      slow: parseInt(process.env.EMA_SLOW || '21')
    },
    rsi: {
      period: parseInt(process.env.RSI_PERIOD || '14'),
      overbought: parseInt(process.env.RSI_OVERBOUGHT || '70'),
      oversold: parseInt(process.env.RSI_OVERSOLD || '30'),
      buyMin: parseInt(process.env.RSI_BUY_MIN || '50'),
      sellMax: parseInt(process.env.RSI_SELL_MAX || '50')
    },
    minCandles: parseInt(process.env.MIN_CANDLES || '21') // Minimum candles for analysis
  },

  // MEXC Futures API Configuration
  mexc: {
    apiKey: process.env.MEXC_API_KEY,
    secretKey: process.env.MEXC_SECRET_KEY,
    baseURL: process.env.MEXC_BASE_URL || 'https://contract.mexc.com',
    timeout: parseInt(process.env.MEXC_TIMEOUT || '10000'), // 10 seconds
    tradingMode: 'futures', // Futures only (no spot trading)
    leverage: parseInt(process.env.MEXC_LEVERAGE || '10'), // 10x leverage
    positionMode: process.env.MEXC_POSITION_MODE || 'isolated' // isolated or cross
  },

  // Dify AI Configuration
  dify: {
    apiKey: process.env.DIFY_API_KEY,
    baseURL: process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1',
    timeout: parseInt(process.env.DIFY_TIMEOUT || '30000') // 30 seconds
  },

  // Rate Limiting
  rateLimiting: {
    enabled: process.env.RATE_LIMITING_ENABLED !== 'false',
    maxRequestsPerSecond: parseInt(process.env.MAX_REQUESTS_PER_SECOND || '5'),
    mexcIPWeight: {
      max: parseInt(process.env.MEXC_IP_WEIGHT_MAX || '60'),
      refillPerSecond: parseInt(process.env.MEXC_IP_WEIGHT_REFILL || '15')
    },
    mexcUIDWeight: {
      max: parseInt(process.env.MEXC_UID_WEIGHT_MAX || '100'),
      refillPerSecond: parseInt(process.env.MEXC_UID_WEIGHT_REFILL || '20')
    }
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info', // 'debug', 'info', 'warn', 'error'
    enableConsole: process.env.LOG_CONSOLE !== 'false',
    enableFile: process.env.LOG_FILE === 'true',
    filePath: process.env.LOG_FILE_PATH || './logs/trading.log'
  },

  // Backtest Configuration
  backtest: {
    dataPath: process.env.BACKTEST_DATA_PATH || './tests/data/historical.json',
    initialBalance: parseFloat(process.env.BACKTEST_INITIAL_BALANCE || '5000'),
    commission: parseFloat(process.env.BACKTEST_COMMISSION || '0.1') // 0.1% per trade
  },

  // n8n Configuration
  n8n: {
    allowedExternal: process.env.NODE_FUNCTION_ALLOW_EXTERNAL || 'technicalindicators,crypto-js',
    executionTimeout: parseInt(process.env.N8N_EXECUTION_TIMEOUT || '120000') // 2 minutes
  }
};

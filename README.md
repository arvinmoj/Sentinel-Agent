# Sentinel Agent - XRP/USDT Trading Bot

A robust, modular trading bot for XRP/USDT (30-minute timeframe) that integrates Node.js technical analysis with n8n workflow automation and Dify.ai for intelligent trade validation.

## 🎯 Features

- **Technical Strategy**: EMA(9), EMA(21), and RSI(14) indicators with refined entry logic
- **Dynamic Risk Management**: Calculates stop-loss from 5-candle lows/highs with 1:2 risk/reward ratio
- **MEXC Futures API Integration**: 10x leveraged trading with isolated margin on perpetual contracts
- **Futures-Only Mode**: Long/short positions with automatic contract quantity calculation
- **Rate Limiting**: Token bucket implementation respecting MEXC weight-based limits
- **n8n Compatibility**: Pre-built workflow JSON and Code Node wrapper
- **Dify AI Analysis**: LLM-powered trade signal validation
- **Backtest Module**: Historical performance testing with P&L tracking

## 📁 Repository Structure

```
/Sentinel-Agent
├── .env.example              # Environment variables template
├── .gitignore               # Git ignore patterns
├── package.json             # Node.js dependencies
├── README.md                # This file
├── /config
│   └── settings.js          # Centralized configuration
├── /src
│   ├── strategy.js          # Technical analysis (EMA, RSI)
│   ├── risk.js              # Dynamic risk management
│   ├── mexc.js              # MEXC API client with signing
│   ├── rateLimiter.js       # Rate limiting utilities
│   └── n8n-entry.js         # n8n Code Node wrapper
├── /workflows
│   └── trading-bot.json     # Complete n8n workflow
├── /dify
│   └── payload.json         # Dify AI prompt template
└── /tests
    └── backtest.js          # Historical backtesting script
```

## 🚀 Quick Start

### 1. Installation

```bash
# Clone the repository
git clone <repository-url>
cd Sentinel-Agent

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your API keys
nano .env
```

### 2. Configure Environment Variables

Edit `.env` with your credentials:

```bash
# MEXC API Credentials (get from https://www.mexc.com/user/openapi)
MEXC_API_KEY=your_mexc_api_key_here
MEXC_SECRET_KEY=your_mexc_secret_key_here

# MEXC Futures Configuration
MEXC_BASE_URL=https://contract.mexc.com
MEXC_LEVERAGE=10
MEXC_POSITION_MODE=isolated

# Dify AI API Key (get from https://dify.ai)
DIFY_API_KEY=your_dify_api_key_here

# Trading Configuration (Futures Format)
TRADING_SYMBOL=XRP_USDT
TRADING_INTERVAL=30m
POSITION_SIZE_USDT=100
```

### 3. Run Backtest

Test the strategy on historical data:

```bash
npm run backtest
# or
node tests/backtest.js
```

This will:
- Generate sample historical data (or load from `tests/data/historical.json`)
- Run strategy analysis on each candle
- Simulate trades with stop-loss and take-profit
- Output win rate, total P&L, and max drawdown

**Expected Output:**
```
🤖 Sentinel Agent - Backtest Module

✓ Generated sample historical data (200 candles)

============================================================
🚀 STARTING BACKTEST
============================================================
Initial Balance: 5000 USDT
Position Size: 100 USDT
Total Candles: 200
Timeframe: 30m
============================================================

📈 OPEN BUY: Entry 0.502 | SL 0.497 | TP 0.512
📉 CLOSE TAKE_PROFIT: Exit 0.512 | P&L: +1.98 USDT (1.98%) | Balance: 5001.98
...

============================================================
📊 BACKTEST RESULTS
============================================================

💰 FINANCIAL SUMMARY:
Initial Balance:     5000.00 USDT
Final Balance:       5127.45 USDT
Net P&L:             +127.45 USDT (2.55%)
Max Drawdown:        3.12%

📈 TRADE STATISTICS:
Total Trades:        15
Wins:                9 (60.0%)
Losses:              6 (40.0%)
...
```

## 🔧 n8n Integration

### Self-Hosted n8n Configuration

**CRITICAL**: n8n must allow external npm modules for the strategy calculations to work.

#### Option 1: Docker (Recommended)

```yaml
# docker-compose.yml
version: '3'
services:
  n8n:
    image: n8nio/n8n
    ports:
      - "5678:5678"
    environment:
      - NODE_FUNCTION_ALLOW_EXTERNAL=technicalindicators,crypto-js
      - NODE_FUNCTION_ALLOW_BUILTIN=*
    volumes:
      - n8n_data:/home/node/.n8n
      - ./Sentinel-Agent:/data/Sentinel-Agent
```

```bash
docker-compose up -d
```

#### Option 2: Direct Installation

```bash
# Install n8n globally
npm install -g n8n

# Set environment variables
export NODE_FUNCTION_ALLOW_EXTERNAL=technicalindicators,crypto-js
export NODE_FUNCTION_ALLOW_BUILTIN=*

# Start n8n
n8n start
```

### Import Workflow

1. Open n8n at `http://localhost:5678`
2. Click **Workflows** → **Import from File**
3. Select `/workflows/trading-bot.json`
4. Configure credentials:
   - Add MEXC API credentials (API Key + Secret)
   - Add Dify API credentials (Bearer Token)
5. Update environment variables in n8n settings
6. Activate the workflow

### Workflow Overview

The workflow executes every 30 minutes:

```
Schedule Trigger (30m)
    ↓
Fetch MEXC Klines (HTTP Request)
    ↓
Transform Klines (Code Node)
    ↓
Analyze Strategy (Code Node) ← Uses strategy.js & risk.js
    ↓
Dify AI Analysis (HTTP Request)
    ↓
Check Trade Conditions (IF Node)
    ├─ TRUE → Place MEXC Order → Log Execution
    └─ FALSE → Log No Trade
```

## 📊 Strategy Logic

### Entry Signals

**BUY Signal Requirements:**
1. EMA(9) > EMA(21) (Uptrend)
2. RSI > 50 (Bullish momentum)
3. RSI < 70 (Not overbought)
4. Confidence ≥ 60%

**SELL Signal Requirements:**
1. EMA(9) < EMA(21) (Downtrend)
2. RSI < 50 (Bearish momentum)
3. RSI > 30 (Not oversold)
4. Confidence ≥ 60%

### Risk Management

**Stop Loss Calculation:**
- **Long**: Minimum of last 5 candle lows - 0.5% buffer
- **Short**: Maximum of last 5 candle highs + 0.5% buffer

**Take Profit:**
- Fixed 1:2 Risk/Reward ratio
- TP = Entry + 2 × (Entry - Stop Loss)

**Position Sizing:**
- Fixed 100 USDT per trade
- Quantity = 100 / Entry Price

## 🤖 Dify AI Integration

The bot sends technical analysis to Dify.ai for validation:

```javascript
// Payload structure (see /dify/payload.json)
{
  "query": "Analyze this XRP/USDT signal: BUY at 0.502, RSI 58...",
  "user": "sentinel-agent-bot",
  "response_mode": "blocking"
}
```

Dify LLM evaluates:
- Signal strength
- Risk/reward assessment
- Market context
- Final recommendation: EXECUTE, SKIP, or WAIT

## 🧪 Development & Testing

### Test Strategy Module

```bash
node src/n8n-entry.js
```

### Test MEXC Connection

```javascript
const MEXCClient = require('./src/mexc');
const client = new MEXCClient(API_KEY, SECRET_KEY);

// Fetch klines
const candles = await client.getKlines('XRPUSDT', '30m', 50);
console.log(candles);
```

### Validate Rate Limiter

```javascript
const { MEXCRateLimiter } = require('./src/rateLimiter');
const limiter = new MEXCRateLimiter();

// Execute rate-limited API calls
await limiter.execute(async () => {
  return await client.getKlines('XRPUSDT', '30m');
}, 'klines');
```

## ⚙️ Configuration

All settings are centralized in [config/settings.js](config/settings.js):

- **Trading**: Symbol, interval, position size
- **Risk**: Stop-loss buffer, R/R ratio, max risk per trade
- **Strategy**: EMA periods, RSI thresholds
- **API**: MEXC and Dify endpoints, timeouts
- **Rate Limiting**: Token bucket parameters

Override with environment variables (see `.env.example`).

## 🔐 Security Best Practices

1. **Never commit API keys**: Use `.env` (already in `.gitignore`)
2. **MEXC API Restrictions**: Set IP whitelist and read-only permissions during testing
3. **Test on Testnet**: Use MEXC testnet before live trading
4. **Dify API**: Store key server-side only, never in frontend code

## 📈 Performance Optimization

- **Rate Limiting**: Token bucket respects MEXC's 1200 weight/minute limit
- **Candle Caching**: n8n can cache klines between executions
- **Indicator Efficiency**: Uses `technicalindicators` library's optimized calculations
- **Error Handling**: All API calls wrapped in try/catch with structured logging

## 🛠️ Troubleshooting

### n8n Code Node: "Cannot find module 'technicalindicators'"

**Solution**: Ensure `NODE_FUNCTION_ALLOW_EXTERNAL=technicalindicators,crypto-js` is set.

```bash
# Check n8n environment
docker exec -it <n8n-container> env | grep NODE_FUNCTION
```

### MEXC API: "Signature for this request is not valid"

**Solution**: Verify query string encoding and timestamp:

```javascript
// Query string must be sorted and URL-encoded
const queryString = Object.keys(params)
  .sort()
  .map(key => `${key}=${encodeURIComponent(params[key])}`)
  .join('&');

// Timestamp must be within 60 seconds
const timestamp = Date.now();
```

### Backtest: "Insufficient candle data"

**Solution**: Provide at least 21 candles for EMA(21) calculation:

```bash
# Generate more sample data
node tests/backtest.js  # Auto-generates 200 candles
```

## 📚 API References

- **MEXC V3 API**: https://mexcdevelop.github.io/apidocs/spot_v3_en/
- **n8n Documentation**: https://docs.n8n.io/
- **Dify API**: https://docs.dify.ai/
- **technicalindicators**: https://github.com/anandanand84/technicalindicators

## 📄 License

MIT License - see LICENSE file for details.

## ⚠️ Disclaimer

**This bot is for educational purposes only.** Trading cryptocurrencies involves substantial risk of loss. Never trade with money you cannot afford to lose. Past performance does not guarantee future results. Always test thoroughly on testnet before live trading.

---

**Built with ❤️ for algo traders | Powered by Node.js, n8n, and Dify.ai**

const axios = require('axios');
const crypto = require('crypto');

/**
 * MEXC Futures (Perpetual Contract) API Integration
 * Provides methods for fetching market data and placing leveraged orders
 * Trading Mode: Futures Only (10x Leverage, Isolated Margin)
 */

class MEXCClient {
  constructor(apiKey, secretKey, leverage = 10) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.baseURL = 'https://contract.mexc.com';
    this.leverage = leverage;
  }

  /**
   * Generates HMAC-SHA256 signature for authenticated requests
   * @param {string} queryString - URL-encoded query string
   * @returns {string} Hex signature
   */
  generateSignature(queryString) {
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(queryString)
      .digest('hex');
  }

  /**
   * Builds query string from parameters object
   * @param {Object} params - Request parameters
   * @returns {string} URL-encoded query string
   */
  buildQueryString(params) {
    return Object.keys(params)
      .sort()
      .map(key => `${key}=${encodeURIComponent(params[key])}`)
      .join('&')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29');
  }

  /**
   * Fetches candlestick/kline data from MEXC Futures
   * @param {string} symbol - Trading pair in futures format (e.g., 'XRP_USDT')
   * @param {string} interval - Time interval (e.g., 'Min30', 'Min60', 'Day1')
   * @param {number} limit - Number of candles to fetch (default: 100, max: 2000)
   * @param {number} startTime - Start time in seconds (optional)
   * @param {number} endTime - End time in seconds (optional)
   * @returns {Promise<Array>} Array of candles [{timestamp, open, high, low, close, volume}]
   */
  async getKlines(symbol, interval = 'Min30', limit = 100, startTime = null, endTime = null) {
    try {
      // Convert spot symbol format to futures format if needed
      const futuresSymbol = symbol.includes('_') ? symbol : symbol.replace(/USDT$/, '_USDT');
      
      // Convert interval format: '30m' -> 'Min30', '1h' -> 'Min60', '1d' -> 'Day1'
      const futuresInterval = this.convertIntervalToFutures(interval);
      
      const params = {
        symbol: futuresSymbol,
        interval: futuresInterval,
        limit
      };

      if (startTime) params.start = Math.floor(startTime / 1000); // Convert ms to seconds
      if (endTime) params.end = Math.floor(endTime / 1000);

      const queryString = this.buildQueryString(params);
      const url = `${this.baseURL}/api/v1/contract/kline/${futuresSymbol}?${queryString}`;

      console.log(`[MEXC Futures] Fetching klines: ${futuresSymbol} ${futuresInterval} (limit: ${limit})`);

      const response = await axios.get(url, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      // Transform MEXC Futures response format to standard OHLCV
      const candles = response.data.data.map(candle => ({
        timestamp: new Date(candle.time * 1000).toISOString(),
        timestampMs: candle.time * 1000,
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseFloat(candle.vol)
      }));

      console.log(`[MEXC Futures] Successfully fetched ${candles.length} candles`);
      return candles;

    } catch (error) {
      console.error('[MEXC Futures] Error fetching klines:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      throw new Error(`Failed to fetch klines: ${error.message}`);
    }
  }

  /**
   * Converts spot interval format to futures interval format
   * @param {string} interval - Spot interval (e.g., '30m', '1h', '1d')
   * @returns {string} Futures interval (e.g., 'Min30', 'Min60', 'Day1')
   */
  convertIntervalToFutures(interval) {
    const mapping = {
      '1m': 'Min1', '5m': 'Min5', '15m': 'Min15', '30m': 'Min30',
      '1h': 'Min60', '4h': 'Hour4', '8h': 'Hour8',
      '1d': 'Day1', '1w': 'Week1', '1M': 'Month1'
    };
    return mapping[interval] || interval;
  }

  /**
   * Places a futures order on MEXC (10x Isolated Margin)
   * @param {string} symbol - Trading pair in futures format (e.g., 'XRP_USDT')
   * @param {string} side - Position side ('LONG' or 'SHORT')
   * @param {number} quantity - Contract quantity (leverage-adjusted)
   * @param {string} type - Order type ('MARKET' or 'LIMIT', default: 'MARKET')
   * @param {number} price - Limit price (required for LIMIT orders)
   * @param {boolean} isOpen - True to open position, false to close (default: true)
   * @returns {Promise<Object>} Order response
   */
  async placeOrder(symbol, side, quantity, type = 'MARKET', price = null, isOpen = true) {
    try {
      // Convert spot symbol format to futures format if needed
      const futuresSymbol = symbol.includes('_') ? symbol : symbol.replace(/USDT$/, '_USDT');
      
      // Convert side to futures order side codes:
      // 1 = Open Long, 2 = Close Short, 3 = Open Short, 4 = Close Long
      let orderSide;
      if (side.toUpperCase() === 'LONG' || side.toUpperCase() === 'BUY') {
        orderSide = isOpen ? 1 : 4; // 1 = Open Long, 4 = Close Long
      } else if (side.toUpperCase() === 'SHORT' || side.toUpperCase() === 'SELL') {
        orderSide = isOpen ? 3 : 2; // 3 = Open Short, 2 = Close Short
      } else {
        throw new Error(`Invalid side: ${side}. Use LONG/BUY or SHORT/SELL`);
      }

      // Convert order type: 5 = MARKET, 6 = LIMIT
      const orderType = type.toUpperCase() === 'MARKET' ? 5 : 6;

      const timestamp = Date.now();
      const externalOid = `sentinel-${timestamp}`;

      const orderData = {
        symbol: futuresSymbol,
        side: orderSide,
        type: orderType,
        vol: Math.floor(quantity), // Must be integer contract count
        openType: 1, // 1 = Isolated margin
        leverage: this.leverage,
        externalOid: externalOid,
        timestamp
      };

      // Add price for limit orders
      if (orderType === 6) {
        if (!price) {
          throw new Error('Price is required for LIMIT orders');
        }
        orderData.price = price;
      }

      // Generate signature for futures API
      const params = Object.keys(orderData)
        .sort()
        .map(key => `${key}=${orderData[key]}`)
        .join('&');
      const signature = this.generateSignature(params);

      const url = `${this.baseURL}/api/v1/private/order/submit`;

      const sideText = orderSide === 1 ? 'OPEN_LONG' : orderSide === 2 ? 'CLOSE_SHORT' : orderSide === 3 ? 'OPEN_SHORT' : 'CLOSE_LONG';
      console.log(`[MEXC Futures] Placing ${type} ${sideText} order: ${quantity} contracts ${futuresSymbol} @${this.leverage}x`);

      const response = await axios.post(url, orderData, {
        headers: {
          'Content-Type': 'application/json',
          'X-MEXC-APIKEY': this.apiKey,
          'Request-Time': timestamp.toString(),
          'Signature': signature
        },
        timeout: 10000
      });

      console.log('[MEXC Futures] Order placed successfully:', {
        orderId: response.data.data,
        symbol: futuresSymbol,
        side: sideText,
        type: type,
        contracts: quantity,
        leverage: this.leverage
      });

      return {
        success: true,
        orderId: response.data.data,
        symbol: futuresSymbol,
        side: sideText,
        type: type,
        contracts: quantity,
        leverage: this.leverage,
        openType: 'isolated',
        transactTime: new Date(timestamp).toISOString(),
        rawResponse: response.data
      };

    } catch (error) {
      console.error('[MEXC Futures] Error placing order:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        params: { symbol, side, quantity, type, price }
      });

      return {
        success: false,
        error: error.message,
        details: error.response?.data,
        params: { symbol, side, quantity, type, price }
      };
    }
  }

  /**
   * Gets futures account information including balances and positions
   * @returns {Promise<Object>} Futures account data
   */
  async getAccountInfo() {
    try {
      const timestamp = Date.now();
      const signature = this.generateSignature(`timestamp=${timestamp}`);

      const url = `${this.baseURL}/api/v1/private/account/assets`;

      const response = await axios.get(url, {
        headers: {
          'Content-Type': 'application/json',
          'X-MEXC-APIKEY': this.apiKey,
          'Request-Time': timestamp.toString(),
          'Signature': signature
        },
        params: { timestamp },
        timeout: 10000
      });

      console.log('[MEXC Futures] Account info retrieved successfully');
      return response.data;

    } catch (error) {
      console.error('[MEXC Futures] Error fetching account info:', {
        message: error.message,
        response: error.response?.data
      });
      throw new Error(`Failed to fetch account info: ${error.message}`);
    }
  }

  /**
   * Gets current order book depth
   * @param {string} symbol - Trading pair
   * @param {number} limit - Depth limit (5, 10, 20, 50, 100, 500, 1000, 5000)
   * @returns {Promise<Object>} Order book {bids, asks}
   */
  async getOrderBook(symbol, limit = 20) {
    try {
      const params = {
        symbol: symbol.toUpperCase(),
        limit
      };

      const queryString = this.buildQueryString(params);
      const url = `${this.baseURL}/api/v3/depth?${queryString}`;

      const response = await axios.get(url, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return {
        bids: response.data.bids.map(b => ({
          price: parseFloat(b[0]),
          quantity: parseFloat(b[1])
        })),
        asks: response.data.asks.map(a => ({
          price: parseFloat(a[0]),
          quantity: parseFloat(a[1])
        }))
      };

    } catch (error) {
      console.error('[MEXC] Error fetching order book:', error.message);
      throw new Error(`Failed to fetch order book: ${error.message}`);
    }
  }

  /**
   * Gets current futures ticker price
   * @param {string} symbol - Trading pair in futures format (e.g., 'XRP_USDT')
   * @returns {Promise<number>} Current price
   */
  async getCurrentPrice(symbol) {
    try {
      // Convert spot symbol format to futures format if needed
      const futuresSymbol = symbol.includes('_') ? symbol : symbol.replace(/USDT$/, '_USDT');
      
      const url = `${this.baseURL}/api/v1/contract/ticker?symbol=${futuresSymbol}`;

      const response = await axios.get(url, {
        timeout: 10000
      });

      return parseFloat(response.data.data[0].lastPrice);

    } catch (error) {
      console.error('[MEXC Futures] Error fetching current price:', error.message);
      throw new Error(`Failed to fetch current price: ${error.message}`);
    }
  }
}

module.exports = MEXCClient;

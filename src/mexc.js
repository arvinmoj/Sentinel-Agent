const axios = require('axios');
const crypto = require('crypto');

/**
 * MEXC V3 Spot API Integration
 * Provides methods for fetching market data and placing orders
 */

class MEXCClient {
  constructor(apiKey, secretKey) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.baseURL = 'https://api.mexc.com';
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
   * Fetches candlestick/kline data from MEXC
   * @param {string} symbol - Trading pair (e.g., 'XRPUSDT')
   * @param {string} interval - Time interval (e.g., '30m', '1h', '1d')
   * @param {number} limit - Number of candles to fetch (default: 100, max: 1000)
   * @param {number} startTime - Start time in milliseconds (optional)
   * @param {number} endTime - End time in milliseconds (optional)
   * @returns {Promise<Array>} Array of candles [{timestamp, open, high, low, close, volume}]
   */
  async getKlines(symbol, interval = '30m', limit = 100, startTime = null, endTime = null) {
    try {
      const params = {
        symbol: symbol.toUpperCase(),
        interval,
        limit
      };

      if (startTime) params.startTime = startTime;
      if (endTime) params.endTime = endTime;

      const queryString = this.buildQueryString(params);
      const url = `${this.baseURL}/api/v3/klines?${queryString}`;

      console.log(`[MEXC] Fetching klines: ${symbol} ${interval} (limit: ${limit})`);

      const response = await axios.get(url, {
        headers: {
          'Content-Type': 'application/json',
          'X-MEXC-APIKEY': this.apiKey
        },
        timeout: 10000
      });

      // Transform MEXC response format to standard OHLCV
      const candles = response.data.map(candle => ({
        timestamp: new Date(candle[0]).toISOString(),
        timestampMs: candle[0],
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
      }));

      console.log(`[MEXC] Successfully fetched ${candles.length} candles`);
      return candles;

    } catch (error) {
      console.error('[MEXC] Error fetching klines:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      throw new Error(`Failed to fetch klines: ${error.message}`);
    }
  }

  /**
   * Places a market or limit order on MEXC
   * @param {string} symbol - Trading pair (e.g., 'XRPUSDT')
   * @param {string} side - Order side ('BUY' or 'SELL')
   * @param {number} quantity - Order quantity (base asset amount)
   * @param {string} type - Order type ('MARKET' or 'LIMIT', default: 'MARKET')
   * @param {number} price - Limit price (required for LIMIT orders)
   * @returns {Promise<Object>} Order response
   */
  async placeOrder(symbol, side, quantity, type = 'MARKET', price = null) {
    try {
      const timestamp = Date.now();
      const params = {
        symbol: symbol.toUpperCase(),
        side: side.toUpperCase(),
        type: type.toUpperCase(),
        quantity: quantity.toString(),
        timestamp
      };

      // Add price for limit orders
      if (type.toUpperCase() === 'LIMIT') {
        if (!price) {
          throw new Error('Price is required for LIMIT orders');
        }
        params.price = price.toString();
        params.timeInForce = 'GTC'; // Good Till Cancel
      }

      // Build query string and generate signature
      const queryString = this.buildQueryString(params);
      const signature = this.generateSignature(queryString);
      const signedQueryString = `${queryString}&signature=${signature}`;

      const url = `${this.baseURL}/api/v3/order?${signedQueryString}`;

      console.log(`[MEXC] Placing ${type} ${side} order: ${quantity} ${symbol}`);

      const response = await axios.post(url, null, {
        headers: {
          'Content-Type': 'application/json',
          'X-MEXC-APIKEY': this.apiKey
        },
        timeout: 10000
      });

      console.log('[MEXC] Order placed successfully:', {
        orderId: response.data.orderId,
        symbol: response.data.symbol,
        side: response.data.side,
        type: response.data.type,
        quantity: response.data.origQty,
        price: response.data.price
      });

      return {
        success: true,
        orderId: response.data.orderId,
        symbol: response.data.symbol,
        side: response.data.side,
        type: response.data.type,
        quantity: parseFloat(response.data.origQty),
        price: parseFloat(response.data.price || 0),
        transactTime: new Date(response.data.transactTime).toISOString(),
        rawResponse: response.data
      };

    } catch (error) {
      console.error('[MEXC] Error placing order:', {
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
   * Gets account information including balances
   * @returns {Promise<Object>} Account data
   */
  async getAccountInfo() {
    try {
      const timestamp = Date.now();
      const params = { timestamp };

      const queryString = this.buildQueryString(params);
      const signature = this.generateSignature(queryString);
      const signedQueryString = `${queryString}&signature=${signature}`;

      const url = `${this.baseURL}/api/v3/account?${signedQueryString}`;

      const response = await axios.get(url, {
        headers: {
          'Content-Type': 'application/json',
          'X-MEXC-APIKEY': this.apiKey
        },
        timeout: 10000
      });

      console.log('[MEXC] Account info retrieved successfully');
      return response.data;

    } catch (error) {
      console.error('[MEXC] Error fetching account info:', {
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
   * Gets current ticker price
   * @param {string} symbol - Trading pair
   * @returns {Promise<number>} Current price
   */
  async getCurrentPrice(symbol) {
    try {
      const url = `${this.baseURL}/api/v3/ticker/price?symbol=${symbol.toUpperCase()}`;

      const response = await axios.get(url, {
        timeout: 10000
      });

      return parseFloat(response.data.price);

    } catch (error) {
      console.error('[MEXC] Error fetching current price:', error.message);
      throw new Error(`Failed to fetch current price: ${error.message}`);
    }
  }
}

module.exports = MEXCClient;

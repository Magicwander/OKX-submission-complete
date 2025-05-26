import axios from 'axios';

/**
 * OKX DEX API Client
 * Provides easy access to OKX DEX market data including prices, volumes, and order books
 */
class OKXDexAPI {
  constructor() {
    this.baseURL = 'https://www.okx.com/api/v5';
    this.dexBaseURL = 'https://www.okx.com/priapi/v1/dx';
    this.client = axios.create({
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'OKX-DEX-API-Client/1.0.0'
      }
    });
  }

  /**
   * Get ticker information for a specific trading pair
   * @param {string} instId - Trading pair (e.g., 'BTC-USDT')
   * @returns {Promise<Object>} Ticker data including price and volume
   */
  async getTicker(instId) {
    try {
      const response = await this.client.get(`${this.baseURL}/market/ticker`, {
        params: { instId }
      });
      
      if (response.data.code === '0' && response.data.data.length > 0) {
        const ticker = response.data.data[0];
        return {
          symbol: ticker.instId,
          lastPrice: parseFloat(ticker.last),
          volume24h: parseFloat(ticker.vol24h),
          volumeCcy24h: parseFloat(ticker.volCcy24h),
          high24h: parseFloat(ticker.high24h),
          low24h: parseFloat(ticker.low24h),
          open24h: parseFloat(ticker.open24h),
          change24h: parseFloat(ticker.last) - parseFloat(ticker.open24h),
          changePercent24h: ((parseFloat(ticker.last) - parseFloat(ticker.open24h)) / parseFloat(ticker.open24h) * 100).toFixed(2),
          timestamp: parseInt(ticker.ts)
        };
      }
      throw new Error('No data found for the specified trading pair');
    } catch (error) {
      throw new Error(`Failed to fetch ticker: ${error.message}`);
    }
  }

  /**
   * Get order book data for a specific trading pair
   * @param {string} instId - Trading pair (e.g., 'BTC-USDT')
   * @param {number} sz - Order book depth (default: 20, max: 400)
   * @returns {Promise<Object>} Order book with bids and asks
   */
  async getOrderBook(instId, sz = 20) {
    try {
      const response = await this.client.get(`${this.baseURL}/market/books`, {
        params: { instId, sz }
      });
      
      if (response.data.code === '0' && response.data.data.length > 0) {
        const orderBook = response.data.data[0];
        return {
          symbol: instId,
          bids: orderBook.bids.map(bid => ({
            price: parseFloat(bid[0]),
            size: parseFloat(bid[1]),
            orders: parseInt(bid[2]) || 0,
            total: parseFloat(bid[3]) || 0
          })),
          asks: orderBook.asks.map(ask => ({
            price: parseFloat(ask[0]),
            size: parseFloat(ask[1]),
            orders: parseInt(ask[2]) || 0,
            total: parseFloat(ask[3]) || 0
          })),
          timestamp: parseInt(orderBook.ts)
        };
      }
      throw new Error('No order book data found for the specified trading pair');
    } catch (error) {
      throw new Error(`Failed to fetch order book: ${error.message}`);
    }
  }

  /**
   * Get 24h trading statistics for all trading pairs or specific ones
   * @param {string} instType - Instrument type ('SPOT', 'MARGIN', 'SWAP', 'FUTURES', 'OPTION')
   * @param {string} uly - Underlying (optional)
   * @returns {Promise<Array>} Array of trading statistics
   */
  async get24hStats(instType = 'SPOT', uly = null) {
    try {
      const params = { instType };
      if (uly) params.uly = uly;
      
      const response = await this.client.get(`${this.baseURL}/market/tickers`, {
        params
      });
      
      if (response.data.code === '0') {
        return response.data.data.map(ticker => ({
          symbol: ticker.instId,
          lastPrice: parseFloat(ticker.last),
          volume24h: parseFloat(ticker.vol24h),
          volumeCcy24h: parseFloat(ticker.volCcy24h),
          high24h: parseFloat(ticker.high24h),
          low24h: parseFloat(ticker.low24h),
          open24h: parseFloat(ticker.open24h),
          change24h: parseFloat(ticker.last) - parseFloat(ticker.open24h),
          changePercent24h: ((parseFloat(ticker.last) - parseFloat(ticker.open24h)) / parseFloat(ticker.open24h) * 100).toFixed(2),
          timestamp: parseInt(ticker.ts)
        }));
      }
      throw new Error('Failed to fetch 24h statistics');
    } catch (error) {
      throw new Error(`Failed to fetch 24h stats: ${error.message}`);
    }
  }

  /**
   * Get recent trades for a specific trading pair
   * @param {string} instId - Trading pair (e.g., 'BTC-USDT')
   * @param {number} limit - Number of trades to fetch (default: 100, max: 500)
   * @returns {Promise<Array>} Array of recent trades
   */
  async getRecentTrades(instId, limit = 100) {
    try {
      const response = await this.client.get(`${this.baseURL}/market/trades`, {
        params: { instId, limit }
      });
      
      if (response.data.code === '0') {
        return response.data.data.map(trade => ({
          tradeId: trade.tradeId,
          price: parseFloat(trade.px),
          size: parseFloat(trade.sz),
          side: trade.side, // 'buy' or 'sell'
          timestamp: parseInt(trade.ts)
        }));
      }
      throw new Error('No trade data found for the specified trading pair');
    } catch (error) {
      throw new Error(`Failed to fetch recent trades: ${error.message}`);
    }
  }

  /**
   * Get candlestick/OHLCV data
   * @param {string} instId - Trading pair (e.g., 'BTC-USDT')
   * @param {string} bar - Time period ('1m', '3m', '5m', '15m', '30m', '1H', '2H', '4H', '6H', '12H', '1D', '1W', '1M', '3M')
   * @param {number} limit - Number of candles (default: 100, max: 300)
   * @returns {Promise<Array>} Array of OHLCV data
   */
  async getCandlesticks(instId, bar = '1H', limit = 100) {
    try {
      const response = await this.client.get(`${this.baseURL}/market/candles`, {
        params: { instId, bar, limit }
      });
      
      if (response.data.code === '0') {
        return response.data.data.map(candle => ({
          timestamp: parseInt(candle[0]),
          open: parseFloat(candle[1]),
          high: parseFloat(candle[2]),
          low: parseFloat(candle[3]),
          close: parseFloat(candle[4]),
          volume: parseFloat(candle[5]),
          volumeCcy: parseFloat(candle[6])
        }));
      }
      throw new Error('No candlestick data found for the specified trading pair');
    } catch (error) {
      throw new Error(`Failed to fetch candlesticks: ${error.message}`);
    }
  }

  /**
   * Get all available trading instruments
   * @param {string} instType - Instrument type ('SPOT', 'MARGIN', 'SWAP', 'FUTURES', 'OPTION')
   * @returns {Promise<Array>} Array of available instruments
   */
  async getInstruments(instType = 'SPOT') {
    try {
      const response = await this.client.get(`${this.baseURL}/public/instruments`, {
        params: { instType }
      });
      
      if (response.data.code === '0') {
        return response.data.data.map(instrument => ({
          symbol: instrument.instId,
          baseCurrency: instrument.baseCcy,
          quoteCurrency: instrument.quoteCcy,
          minSize: parseFloat(instrument.minSz),
          tickSize: parseFloat(instrument.tickSz),
          lotSize: parseFloat(instrument.lotSz),
          state: instrument.state
        }));
      }
      throw new Error('Failed to fetch instruments');
    } catch (error) {
      throw new Error(`Failed to fetch instruments: ${error.message}`);
    }
  }
}

export default OKXDexAPI;
/**
 * PriceFeedAccount Structure
 * 
 * Defines the comprehensive structure for storing token details and price data
 * on the Solana blockchain. This structure supports multiple price sources,
 * historical data, and advanced oracle functionality.
 * 
 * @author Solana Keeper Service
 * @version 1.0.0
 */

import { PublicKey } from '@solana/web3.js';
import { Decimal } from 'decimal.js';

/**
 * Price Feed Account Structure
 * 
 * This structure defines how price data is stored on-chain for each token pair.
 * It includes comprehensive metadata, price history, and validation data.
 */
export class PriceFeedAccount {
  constructor() {
    // Account metadata
    this.version = 1;                    // Schema version for upgrades
    this.isInitialized = false;          // Account initialization flag
    this.authority = null;               // Authority that can update prices
    this.createdAt = 0;                  // Account creation timestamp
    this.lastUpdated = 0;                // Last price update timestamp
    
    // Token pair information
    this.tokenPair = {
      base: {
        symbol: '',                      // e.g., 'SOL'
        mint: null,                      // Token mint address
        decimals: 0,                     // Token decimals
        name: '',                        // Full token name
        logoUri: ''                      // Token logo URI
      },
      quote: {
        symbol: '',                      // e.g., 'USDC'
        mint: null,                      // Token mint address
        decimals: 0,                     // Token decimals
        name: '',                        // Full token name
        logoUri: ''                      // Token logo URI
      },
      pairId: '',                        // Unique pair identifier (e.g., 'SOL/USDC')
      category: 'SPOT'                   // SPOT, FUTURES, OPTIONS, etc.
    };
    
    // Current price data
    this.currentPrice = {
      price: new Decimal(0),             // Current aggregated price
      confidence: 0,                     // Price confidence (0-100)
      sources: [],                       // Array of price sources
      dataPoints: 0,                     // Number of data points used
      lastUpdateSlot: 0,                 // Solana slot of last update
      updateAuthority: null,             // Who updated this price
      priceType: 'AGGREGATED'            // AGGREGATED, VWAP, TWAP, etc.
    };
    
    // Price statistics
    this.statistics = {
      // 24-hour statistics
      high24h: new Decimal(0),           // 24h high price
      low24h: new Decimal(0),            // 24h low price
      volume24h: new Decimal(0),         // 24h trading volume
      change24h: new Decimal(0),         // 24h price change
      changePercent24h: new Decimal(0),  // 24h percentage change
      
      // 7-day statistics
      high7d: new Decimal(0),            // 7d high price
      low7d: new Decimal(0),             // 7d low price
      volume7d: new Decimal(0),          // 7d trading volume
      change7d: new Decimal(0),          // 7d price change
      changePercent7d: new Decimal(0),   // 7d percentage change
      
      // All-time statistics
      allTimeHigh: new Decimal(0),       // All-time high price
      allTimeLow: new Decimal(0),        // All-time low price
      allTimeHighDate: 0,                // ATH timestamp
      allTimeLowDate: 0,                 // ATL timestamp
      
      // Update statistics
      totalUpdates: 0,                   // Total number of updates
      successfulUpdates: 0,              // Successful updates
      failedUpdates: 0,                  // Failed updates
      averageUpdateInterval: 0,          // Average time between updates
      lastUpdateDuration: 0              // Duration of last update
    };
    
    // Price sources configuration
    this.sources = {
      enabled: [],                       // Array of enabled sources
      weights: new Map(),                // Source weights for aggregation
      lastFetch: new Map(),              // Last fetch timestamp per source
      reliability: new Map(),            // Reliability score per source
      configuration: {
        okx: {
          enabled: true,
          weight: 1.0,
          endpoint: 'https://www.okx.com/api/v5/market/tickers',
          rateLimit: 1000,               // ms between requests
          timeout: 10000,                // Request timeout
          retries: 3                     // Number of retries
        },
        binance: {
          enabled: true,
          weight: 1.0,
          endpoint: 'https://api.binance.com/api/v3/ticker/price',
          rateLimit: 1000,
          timeout: 10000,
          retries: 3
        },
        coingecko: {
          enabled: true,
          weight: 0.8,                   // Lower weight for free tier
          endpoint: 'https://api.coingecko.com/api/v3/simple/price',
          rateLimit: 2000,               // Slower rate limit
          timeout: 15000,
          retries: 2
        },
        raydium: {
          enabled: false,                // On-chain DEX data
          weight: 1.2,                   // Higher weight for on-chain
          rateLimit: 500,
          timeout: 5000,
          retries: 2
        },
        orca: {
          enabled: false,                // On-chain DEX data
          weight: 1.2,
          rateLimit: 500,
          timeout: 5000,
          retries: 2
        }
      }
    };
    
    // Price history (circular buffer)
    this.history = {
      maxEntries: 1000,                  // Maximum history entries
      currentIndex: 0,                   // Current position in circular buffer
      entries: [],                       // Price history entries
      compression: 'NONE'                // NONE, GZIP, LZ4
    };
    
    // Validation and quality control
    this.validation = {
      priceThreshold: 0.05,              // 5% maximum price change
      outlierDetection: true,            // Enable outlier detection
      minimumSources: 2,                 // Minimum sources required
      maximumAge: 300000,                // Maximum price age (5 minutes)
      confidenceThreshold: 70,           // Minimum confidence required
      
      // Circuit breaker
      circuitBreaker: {
        enabled: true,
        errorThreshold: 5,               // Errors before breaking
        timeWindow: 60000,               // Time window for error counting
        recoveryTime: 300000,            // Recovery time after break
        currentErrors: 0,
        lastError: 0,
        isBroken: false
      }
    };
    
    // Oracle program integration
    this.oracle = {
      programId: null,                   // Oracle program ID
      accountAddress: null,              // This account's address
      updateInstruction: 'update_price', // Instruction name for updates
      permissions: {
        canUpdate: [],                   // Addresses that can update
        canRead: [],                     // Addresses that can read (if restricted)
        isPublic: true                   // Public read access
      },
      
      // Aggregation settings
      aggregation: {
        method: 'WEIGHTED_AVERAGE',      // SIMPLE_AVERAGE, WEIGHTED_AVERAGE, VWAP, TWAP
        outlierFilter: 'ZSCORE',         // NONE, ZSCORE, IQR, MEDIAN_ABSOLUTE_DEVIATION
        outlierThreshold: 2.0,           // Z-score threshold for outliers
        minimumDataPoints: 2,            // Minimum data points for aggregation
        maxAge: 60000                    // Maximum age of data points (1 minute)
      }
    };
    
    // Performance metrics
    this.performance = {
      updateLatency: {
        average: 0,                      // Average update latency
        min: 0,                          // Minimum update latency
        max: 0,                          // Maximum update latency
        samples: []                      // Recent latency samples
      },
      
      throughput: {
        updatesPerSecond: 0,             // Current updates per second
        updatesPerMinute: 0,             // Current updates per minute
        peakThroughput: 0,               // Peak throughput achieved
        averageThroughput: 0             // Average throughput
      },
      
      reliability: {
        uptime: 0,                       // Uptime percentage
        successRate: 0,                  // Success rate percentage
        lastDowntime: 0,                 // Last downtime timestamp
        totalDowntime: 0,                // Total downtime duration
        mtbf: 0                          // Mean time between failures
      }
    };
    
    // Reserved space for future upgrades
    this.reserved = new Array(64).fill(0);
  }
  
  /**
   * Initialize the price feed account
   */
  initialize(tokenPair, authority, oracleProgram) {
    this.isInitialized = true;
    this.authority = authority;
    this.createdAt = Date.now();
    this.lastUpdated = Date.now();
    this.tokenPair = { ...this.tokenPair, ...tokenPair };
    this.oracle.programId = oracleProgram;
    
    // Initialize price history
    this.history.entries = new Array(this.history.maxEntries).fill(null);
    
    // Set initial statistics
    this.statistics.allTimeHigh = new Decimal(0);
    this.statistics.allTimeLow = new Decimal(Number.MAX_SAFE_INTEGER);
  }
  
  /**
   * Update the current price
   */
  updatePrice(priceData) {
    if (!this.isInitialized) {
      throw new Error('Account not initialized');
    }
    
    const now = Date.now();
    const oldPrice = this.currentPrice.price;
    
    // Update current price
    this.currentPrice = {
      ...this.currentPrice,
      ...priceData,
      lastUpdateSlot: priceData.slot || 0
    };
    
    // Add to history
    this.addToHistory({
      price: priceData.price,
      timestamp: now,
      sources: priceData.sources,
      confidence: priceData.confidence
    });
    
    // Update statistics
    this.updateStatistics(priceData.price, oldPrice, now);
    
    // Update performance metrics
    this.updatePerformanceMetrics(now);
    
    this.lastUpdated = now;
    this.statistics.totalUpdates++;
  }
  
  /**
   * Add price entry to history
   */
  addToHistory(entry) {
    this.history.entries[this.history.currentIndex] = entry;
    this.history.currentIndex = (this.history.currentIndex + 1) % this.history.maxEntries;
  }
  
  /**
   * Update price statistics
   */
  updateStatistics(newPrice, oldPrice, timestamp) {
    const price = new Decimal(newPrice);
    
    // Update 24h statistics
    this.update24hStats(price, timestamp);
    
    // Update 7d statistics
    this.update7dStats(price, timestamp);
    
    // Update all-time statistics
    if (price.greaterThan(this.statistics.allTimeHigh)) {
      this.statistics.allTimeHigh = price;
      this.statistics.allTimeHighDate = timestamp;
    }
    
    if (price.lessThan(this.statistics.allTimeLow)) {
      this.statistics.allTimeLow = price;
      this.statistics.allTimeLowDate = timestamp;
    }
    
    // Calculate price changes
    if (oldPrice && oldPrice.greaterThan(0)) {
      const change = price.minus(oldPrice);
      const changePercent = change.dividedBy(oldPrice).times(100);
      
      this.statistics.change24h = change;
      this.statistics.changePercent24h = changePercent;
    }
  }
  
  /**
   * Update 24-hour statistics
   */
  update24hStats(price, timestamp) {
    const oneDayAgo = timestamp - (24 * 60 * 60 * 1000);
    
    // Filter history for last 24 hours
    const recent24h = this.history.entries.filter(entry => 
      entry && entry.timestamp >= oneDayAgo
    );
    
    if (recent24h.length > 0) {
      const prices = recent24h.map(entry => new Decimal(entry.price));
      
      this.statistics.high24h = Decimal.max(...prices);
      this.statistics.low24h = Decimal.min(...prices);
      
      // Calculate volume if available
      const volumes = recent24h
        .map(entry => entry.volume)
        .filter(vol => vol !== undefined);
      
      if (volumes.length > 0) {
        this.statistics.volume24h = volumes.reduce(
          (sum, vol) => sum.plus(vol), 
          new Decimal(0)
        );
      }
    }
  }
  
  /**
   * Update 7-day statistics
   */
  update7dStats(price, timestamp) {
    const sevenDaysAgo = timestamp - (7 * 24 * 60 * 60 * 1000);
    
    // Filter history for last 7 days
    const recent7d = this.history.entries.filter(entry => 
      entry && entry.timestamp >= sevenDaysAgo
    );
    
    if (recent7d.length > 0) {
      const prices = recent7d.map(entry => new Decimal(entry.price));
      
      this.statistics.high7d = Decimal.max(...prices);
      this.statistics.low7d = Decimal.min(...prices);
    }
  }
  
  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(timestamp) {
    // Update throughput
    const now = timestamp;
    const oneSecondAgo = now - 1000;
    const oneMinuteAgo = now - 60000;
    
    const recentUpdates1s = this.history.entries.filter(entry => 
      entry && entry.timestamp >= oneSecondAgo
    ).length;
    
    const recentUpdates1m = this.history.entries.filter(entry => 
      entry && entry.timestamp >= oneMinuteAgo
    ).length;
    
    this.performance.throughput.updatesPerSecond = recentUpdates1s;
    this.performance.throughput.updatesPerMinute = recentUpdates1m;
    
    // Update peak throughput
    if (recentUpdates1s > this.performance.throughput.peakThroughput) {
      this.performance.throughput.peakThroughput = recentUpdates1s;
    }
    
    // Calculate success rate
    const totalUpdates = this.statistics.totalUpdates;
    const successfulUpdates = this.statistics.successfulUpdates;
    
    if (totalUpdates > 0) {
      this.performance.reliability.successRate = 
        (successfulUpdates / totalUpdates) * 100;
    }
  }
  
  /**
   * Get current price with metadata
   */
  getCurrentPrice() {
    return {
      price: this.currentPrice.price,
      confidence: this.currentPrice.confidence,
      sources: this.currentPrice.sources,
      dataPoints: this.currentPrice.dataPoints,
      lastUpdated: this.lastUpdated,
      age: Date.now() - this.lastUpdated,
      isStale: (Date.now() - this.lastUpdated) > this.validation.maximumAge
    };
  }
  
  /**
   * Get price history
   */
  getPriceHistory(limit = 100) {
    const validEntries = this.history.entries
      .filter(entry => entry !== null)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
    
    return validEntries;
  }
  
  /**
   * Get account statistics
   */
  getStatistics() {
    return {
      current: this.getCurrentPrice(),
      statistics: this.statistics,
      performance: this.performance,
      sources: {
        enabled: this.sources.enabled,
        reliability: Object.fromEntries(this.sources.reliability)
      }
    };
  }
  
  /**
   * Validate account data integrity
   */
  validate() {
    const errors = [];
    
    if (!this.isInitialized) {
      errors.push('Account not initialized');
    }
    
    if (!this.authority) {
      errors.push('No authority set');
    }
    
    if (!this.tokenPair.pairId) {
      errors.push('No token pair ID set');
    }
    
    if (this.currentPrice.price.lessThanOrEqualTo(0)) {
      errors.push('Invalid current price');
    }
    
    if (this.currentPrice.confidence < this.validation.confidenceThreshold) {
      errors.push('Price confidence below threshold');
    }
    
    const age = Date.now() - this.lastUpdated;
    if (age > this.validation.maximumAge) {
      errors.push('Price data is stale');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Serialize account data for on-chain storage
   */
  serialize() {
    // This would implement the actual serialization logic
    // for storing the account data on Solana blockchain
    return {
      version: this.version,
      isInitialized: this.isInitialized,
      authority: this.authority?.toString(),
      tokenPair: this.tokenPair,
      currentPrice: {
        ...this.currentPrice,
        price: this.currentPrice.price.toString()
      },
      statistics: this.serializeStatistics(),
      lastUpdated: this.lastUpdated,
      // ... other serializable fields
    };
  }
  
  /**
   * Serialize statistics with Decimal conversion
   */
  serializeStatistics() {
    const stats = { ...this.statistics };
    
    // Convert Decimal objects to strings
    Object.keys(stats).forEach(key => {
      if (stats[key] instanceof Decimal) {
        stats[key] = stats[key].toString();
      }
    });
    
    return stats;
  }
  
  /**
   * Deserialize account data from on-chain storage
   */
  static deserialize(data) {
    const account = new PriceFeedAccount();
    
    account.version = data.version;
    account.isInitialized = data.isInitialized;
    account.authority = data.authority ? new PublicKey(data.authority) : null;
    account.tokenPair = data.tokenPair;
    account.currentPrice = {
      ...data.currentPrice,
      price: new Decimal(data.currentPrice.price)
    };
    account.statistics = account.deserializeStatistics(data.statistics);
    account.lastUpdated = data.lastUpdated;
    
    return account;
  }
  
  /**
   * Deserialize statistics with Decimal conversion
   */
  deserializeStatistics(stats) {
    const deserialized = { ...stats };
    
    // Convert string values back to Decimal objects
    const decimalFields = [
      'high24h', 'low24h', 'volume24h', 'change24h', 'changePercent24h',
      'high7d', 'low7d', 'volume7d', 'change7d', 'changePercent7d',
      'allTimeHigh', 'allTimeLow'
    ];
    
    decimalFields.forEach(field => {
      if (deserialized[field]) {
        deserialized[field] = new Decimal(deserialized[field]);
      }
    });
    
    return deserialized;
  }
}

/**
 * Price Feed Account Layout for Borsh serialization
 * 
 * This defines the exact byte layout for on-chain storage
 */
export const PRICE_FEED_ACCOUNT_LAYOUT = {
  // Account header (32 bytes)
  version: 'u8',                         // 1 byte
  isInitialized: 'bool',                 // 1 byte
  authority: 'publicKey',                // 32 bytes
  createdAt: 'u64',                      // 8 bytes
  lastUpdated: 'u64',                    // 8 bytes
  
  // Token pair info (variable length)
  tokenPairId: 'string',                 // Variable length string
  baseMint: 'publicKey',                 // 32 bytes
  quoteMint: 'publicKey',                // 32 bytes
  baseDecimals: 'u8',                    // 1 byte
  quoteDecimals: 'u8',                   // 1 byte
  
  // Current price (64 bytes)
  currentPrice: 'u64',                   // 8 bytes (scaled integer)
  priceDecimals: 'u8',                   // 1 byte
  confidence: 'u8',                      // 1 byte (0-100)
  dataPoints: 'u16',                     // 2 bytes
  lastUpdateSlot: 'u64',                 // 8 bytes
  updateAuthority: 'publicKey',          // 32 bytes
  
  // Statistics (128 bytes)
  high24h: 'u64',                        // 8 bytes
  low24h: 'u64',                         // 8 bytes
  volume24h: 'u64',                      // 8 bytes
  change24h: 'i64',                      // 8 bytes (signed)
  totalUpdates: 'u64',                   // 8 bytes
  successfulUpdates: 'u64',              // 8 bytes
  
  // Reserved space for future upgrades (256 bytes)
  reserved: ['u8', 256]                  // 256 bytes
};

/**
 * Account size calculation
 */
export const PRICE_FEED_ACCOUNT_SIZE = 
  1 +    // version
  1 +    // isInitialized
  32 +   // authority
  8 +    // createdAt
  8 +    // lastUpdated
  32 +   // tokenPairId (max)
  32 +   // baseMint
  32 +   // quoteMint
  1 +    // baseDecimals
  1 +    // quoteDecimals
  8 +    // currentPrice
  1 +    // priceDecimals
  1 +    // confidence
  2 +    // dataPoints
  8 +    // lastUpdateSlot
  32 +   // updateAuthority
  48 +   // statistics (6 * 8 bytes)
  256;   // reserved

export default PriceFeedAccount;
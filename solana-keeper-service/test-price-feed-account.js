/**
 * Test suite for PriceFeedAccount Structure
 * 
 * Comprehensive tests for the price feed account structure,
 * including initialization, updates, serialization, and validation.
 */

import { PublicKey, Keypair } from '@solana/web3.js';
import { Decimal } from 'decimal.js';
import PriceFeedAccount, { PRICE_FEED_ACCOUNT_SIZE } from './price-feed-account.js';

/**
 * Test runner
 */
async function runTests() {
  console.log('🧪 PriceFeedAccount Structure Tests\n');
  
  let passedTests = 0;
  let totalTests = 0;
  
  const test = (name, fn) => {
    totalTests++;
    try {
      fn();
      console.log(`✅ ${name}`);
      passedTests++;
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
    }
  };
  
  // Test 1: Account Creation
  test('Account Creation', () => {
    const account = new PriceFeedAccount();
    
    if (account.version !== 1) throw new Error('Invalid version');
    if (account.isInitialized !== false) throw new Error('Should not be initialized');
    if (account.currentPrice.price.toNumber() !== 0) throw new Error('Price should be 0');
    if (account.history.maxEntries !== 1000) throw new Error('Invalid history size');
  });
  
  // Test 2: Account Initialization
  test('Account Initialization', () => {
    const account = new PriceFeedAccount();
    const authority = Keypair.generate().publicKey;
    const oracleProgram = Keypair.generate().publicKey;
    
    const tokenPair = {
      base: {
        symbol: 'SOL',
        mint: new PublicKey('So11111111111111111111111111111111111111112'),
        decimals: 9,
        name: 'Solana',
        logoUri: 'https://example.com/sol.png'
      },
      quote: {
        symbol: 'USDC',
        mint: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
        decimals: 6,
        name: 'USD Coin',
        logoUri: 'https://example.com/usdc.png'
      },
      pairId: 'SOL/USDC',
      category: 'SPOT'
    };
    
    account.initialize(tokenPair, authority, oracleProgram);
    
    if (!account.isInitialized) throw new Error('Should be initialized');
    if (!account.authority.equals(authority)) throw new Error('Invalid authority');
    if (account.tokenPair.pairId !== 'SOL/USDC') throw new Error('Invalid pair ID');
    if (account.createdAt === 0) throw new Error('Creation time not set');
  });
  
  // Test 3: Price Updates
  test('Price Updates', () => {
    const account = new PriceFeedAccount();
    const authority = Keypair.generate().publicKey;
    const oracleProgram = Keypair.generate().publicKey;
    
    const tokenPair = {
      pairId: 'SOL/USDC',
      base: { symbol: 'SOL', decimals: 9 },
      quote: { symbol: 'USDC', decimals: 6 }
    };
    
    account.initialize(tokenPair, authority, oracleProgram);
    
    const priceData = {
      price: new Decimal(177.50),
      confidence: 95,
      sources: ['okx', 'coingecko'],
      dataPoints: 2,
      slot: 12345
    };
    
    account.updatePrice(priceData);
    
    if (!account.currentPrice.price.equals(177.50)) throw new Error('Price not updated');
    if (account.currentPrice.confidence !== 95) throw new Error('Confidence not updated');
    if (account.currentPrice.sources.length !== 2) throw new Error('Sources not updated');
    if (account.statistics.totalUpdates !== 1) throw new Error('Update count not incremented');
  });
  
  // Test 4: Price History
  test('Price History', () => {
    const account = new PriceFeedAccount();
    const authority = Keypair.generate().publicKey;
    const oracleProgram = Keypair.generate().publicKey;
    
    account.initialize({ pairId: 'SOL/USDC' }, authority, oracleProgram);
    
    // Add multiple price updates with slight delays to ensure different timestamps
    for (let i = 0; i < 5; i++) {
      const priceData = {
        price: new Decimal(175 + i),
        confidence: 90 + i,
        sources: ['okx'],
        dataPoints: 1
      };
      account.updatePrice(priceData);
      // Small delay to ensure different timestamps
      if (i < 4) {
        const start = Date.now();
        while (Date.now() - start < 1) {} // 1ms delay
      }
    }
    
    const history = account.getPriceHistory(3);
    
    if (history.length !== 3) throw new Error('History length incorrect');
    if (!history[0].price.equals(179)) throw new Error('Latest price incorrect');
    if (history[0].confidence !== 94) throw new Error('Latest confidence incorrect');
  });
  
  // Test 5: Statistics Updates
  test('Statistics Updates', () => {
    const account = new PriceFeedAccount();
    const authority = Keypair.generate().publicKey;
    const oracleProgram = Keypair.generate().publicKey;
    
    account.initialize({ pairId: 'SOL/USDC' }, authority, oracleProgram);
    
    // First price update
    account.updatePrice({
      price: new Decimal(100),
      confidence: 90,
      sources: ['okx'],
      dataPoints: 1
    });
    
    // Second price update (higher)
    account.updatePrice({
      price: new Decimal(150),
      confidence: 95,
      sources: ['okx', 'coingecko'],
      dataPoints: 2
    });
    
    if (!account.statistics.allTimeHigh.equals(150)) throw new Error('ATH not updated');
    if (!account.statistics.allTimeLow.equals(100)) throw new Error('ATL not updated');
    if (account.statistics.totalUpdates !== 2) throw new Error('Update count incorrect');
  });
  
  // Test 6: Source Configuration
  test('Source Configuration', () => {
    const account = new PriceFeedAccount();
    
    const okxConfig = account.sources.configuration.okx;
    const binanceConfig = account.sources.configuration.binance;
    const coingeckoConfig = account.sources.configuration.coingecko;
    
    if (!okxConfig.enabled) throw new Error('OKX should be enabled');
    if (okxConfig.weight !== 1.0) throw new Error('OKX weight incorrect');
    if (okxConfig.timeout !== 10000) throw new Error('OKX timeout incorrect');
    
    if (!binanceConfig.enabled) throw new Error('Binance should be enabled');
    if (coingeckoConfig.weight !== 0.8) throw new Error('CoinGecko weight incorrect');
    
    if (account.sources.configuration.raydium.enabled) throw new Error('Raydium should be disabled');
    if (account.sources.configuration.orca.enabled) throw new Error('Orca should be disabled');
  });
  
  // Test 7: Validation
  test('Validation', () => {
    const account = new PriceFeedAccount();
    
    // Test uninitialized account
    let validation = account.validate();
    if (validation.isValid) throw new Error('Uninitialized account should be invalid');
    if (!validation.errors.includes('Account not initialized')) throw new Error('Missing initialization error');
    
    // Initialize account
    const authority = Keypair.generate().publicKey;
    const oracleProgram = Keypair.generate().publicKey;
    account.initialize({ pairId: 'SOL/USDC' }, authority, oracleProgram);
    
    // Test with valid price
    account.updatePrice({
      price: new Decimal(177.50),
      confidence: 95,
      sources: ['okx', 'coingecko'],
      dataPoints: 2
    });
    
    validation = account.validate();
    if (!validation.isValid) throw new Error(`Valid account should pass validation: ${validation.errors.join(', ')}`);
    
    // Test with low confidence
    account.currentPrice.confidence = 50;
    validation = account.validate();
    if (validation.isValid) throw new Error('Low confidence should fail validation');
  });
  
  // Test 8: Serialization
  test('Serialization', () => {
    const account = new PriceFeedAccount();
    const authority = Keypair.generate().publicKey;
    const oracleProgram = Keypair.generate().publicKey;
    
    const tokenPair = {
      pairId: 'SOL/USDC',
      base: { symbol: 'SOL', decimals: 9 },
      quote: { symbol: 'USDC', decimals: 6 }
    };
    
    account.initialize(tokenPair, authority, oracleProgram);
    account.updatePrice({
      price: new Decimal(177.50),
      confidence: 95,
      sources: ['okx', 'coingecko'],
      dataPoints: 2
    });
    
    const serialized = account.serialize();
    
    if (serialized.version !== 1) throw new Error('Serialized version incorrect');
    if (!serialized.isInitialized) throw new Error('Serialized initialization flag incorrect');
    if (serialized.authority !== authority.toString()) throw new Error('Serialized authority incorrect');
    if (serialized.currentPrice.price !== '177.5') throw new Error('Serialized price incorrect');
    if (serialized.tokenPair.pairId !== 'SOL/USDC') throw new Error('Serialized pair ID incorrect');
  });
  
  // Test 9: Deserialization
  test('Deserialization', () => {
    const authority = Keypair.generate().publicKey;
    
    const serializedData = {
      version: 1,
      isInitialized: true,
      authority: authority.toString(),
      tokenPair: { pairId: 'SOL/USDC' },
      currentPrice: { price: '177.5', confidence: 95 },
      statistics: {
        allTimeHigh: '200.0',
        allTimeLow: '150.0',
        totalUpdates: 5
      },
      lastUpdated: Date.now()
    };
    
    const account = PriceFeedAccount.deserialize(serializedData);
    
    if (account.version !== 1) throw new Error('Deserialized version incorrect');
    if (!account.isInitialized) throw new Error('Deserialized initialization flag incorrect');
    if (!account.authority.equals(authority)) throw new Error('Deserialized authority incorrect');
    if (!account.currentPrice.price.equals(177.5)) throw new Error('Deserialized price incorrect');
    if (!account.statistics.allTimeHigh.equals(200)) throw new Error('Deserialized ATH incorrect');
  });
  
  // Test 10: Performance Metrics
  test('Performance Metrics', () => {
    const account = new PriceFeedAccount();
    const authority = Keypair.generate().publicKey;
    const oracleProgram = Keypair.generate().publicKey;
    
    account.initialize({ pairId: 'SOL/USDC' }, authority, oracleProgram);
    
    // Simulate multiple updates
    for (let i = 0; i < 10; i++) {
      account.updatePrice({
        price: new Decimal(175 + i),
        confidence: 90,
        sources: ['okx'],
        dataPoints: 1
      });
      account.statistics.successfulUpdates++;
    }
    
    if (account.statistics.totalUpdates !== 10) throw new Error('Total updates incorrect');
    if (account.statistics.successfulUpdates !== 10) throw new Error('Successful updates incorrect');
    if (account.performance.reliability.successRate !== 100) throw new Error('Success rate incorrect');
  });
  
  // Test 11: Circuit Breaker
  test('Circuit Breaker', () => {
    const account = new PriceFeedAccount();
    
    const circuitBreaker = account.validation.circuitBreaker;
    
    if (!circuitBreaker.enabled) throw new Error('Circuit breaker should be enabled');
    if (circuitBreaker.errorThreshold !== 5) throw new Error('Error threshold incorrect');
    if (circuitBreaker.timeWindow !== 60000) throw new Error('Time window incorrect');
    if (circuitBreaker.isBroken) throw new Error('Circuit breaker should not be broken initially');
  });
  
  // Test 12: Account Size
  test('Account Size Calculation', () => {
    if (PRICE_FEED_ACCOUNT_SIZE < 500) throw new Error('Account size too small');
    if (PRICE_FEED_ACCOUNT_SIZE > 2000) throw new Error('Account size too large');
    
    // Verify minimum required fields are accounted for
    const minSize = 
      1 +    // version
      1 +    // isInitialized
      32 +   // authority
      8 +    // createdAt
      8 +    // lastUpdated
      32 +   // tokenPairId
      64 +   // mints
      8 +    // currentPrice
      48 +   // basic statistics
      256;   // reserved
    
    if (PRICE_FEED_ACCOUNT_SIZE < minSize) throw new Error('Account size calculation incorrect');
  });
  
  // Test 13: Current Price Retrieval
  test('Current Price Retrieval', () => {
    const account = new PriceFeedAccount();
    const authority = Keypair.generate().publicKey;
    const oracleProgram = Keypair.generate().publicKey;
    
    account.initialize({ pairId: 'SOL/USDC' }, authority, oracleProgram);
    
    account.updatePrice({
      price: new Decimal(177.50),
      confidence: 95,
      sources: ['okx', 'coingecko'],
      dataPoints: 2
    });
    
    const currentPrice = account.getCurrentPrice();
    
    if (!currentPrice.price.equals(177.50)) throw new Error('Current price incorrect');
    if (currentPrice.confidence !== 95) throw new Error('Current confidence incorrect');
    if (currentPrice.sources.length !== 2) throw new Error('Current sources incorrect');
    if (currentPrice.isStale) throw new Error('Price should not be stale');
    if (currentPrice.age > 1000) throw new Error('Price age too high');
  });
  
  // Test 14: Statistics Retrieval
  test('Statistics Retrieval', () => {
    const account = new PriceFeedAccount();
    const authority = Keypair.generate().publicKey;
    const oracleProgram = Keypair.generate().publicKey;
    
    account.initialize({ pairId: 'SOL/USDC' }, authority, oracleProgram);
    
    account.updatePrice({
      price: new Decimal(177.50),
      confidence: 95,
      sources: ['okx', 'coingecko'],
      dataPoints: 2
    });
    
    const stats = account.getStatistics();
    
    if (!stats.current) throw new Error('Current price missing from stats');
    if (!stats.statistics) throw new Error('Statistics missing from stats');
    if (!stats.performance) throw new Error('Performance missing from stats');
    if (!stats.sources) throw new Error('Sources missing from stats');
    
    if (stats.statistics.totalUpdates !== 1) throw new Error('Total updates in stats incorrect');
  });
  
  // Test 15: Aggregation Configuration
  test('Aggregation Configuration', () => {
    const account = new PriceFeedAccount();
    
    const aggregation = account.oracle.aggregation;
    
    if (aggregation.method !== 'WEIGHTED_AVERAGE') throw new Error('Default aggregation method incorrect');
    if (aggregation.outlierFilter !== 'ZSCORE') throw new Error('Default outlier filter incorrect');
    if (aggregation.outlierThreshold !== 2.0) throw new Error('Default outlier threshold incorrect');
    if (aggregation.minimumDataPoints !== 2) throw new Error('Default minimum data points incorrect');
    if (aggregation.maxAge !== 60000) throw new Error('Default max age incorrect');
  });
  
  console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('✅ All tests passed! PriceFeedAccount structure is working correctly.');
  } else {
    console.log('❌ Some tests failed. Please review the implementation.');
  }
  
  return { passedTests, totalTests };
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export default runTests;
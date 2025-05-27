/**
 * Task 8: Read Price Functionality - Comprehensive Tests
 * 
 * Tests for the price reading functionality that reads price data
 * from on-chain Solana accounts.
 * 
 * @author Solana Keeper Service
 * @version 1.0.0
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { PriceReader, PriceReaderUtils } from './read-price-functionality.js';

/**
 * Mock connection for testing
 */
class MockConnection {
  constructor() {
    this.mockAccounts = new Map();
    this.callCount = 0;
  }

  async getAccountInfo(publicKey) {
    this.callCount++;
    const key = publicKey.toString();
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
    
    if (this.mockAccounts.has(key)) {
      return this.mockAccounts.get(key);
    }
    
    // Return null for non-existent accounts
    return null;
  }

  setMockAccount(publicKey, accountInfo) {
    this.mockAccounts.set(publicKey.toString(), accountInfo);
  }
}

/**
 * Test suite for Task 8: Read Price Functionality
 */
async function runReadPriceFunctionalityTests() {
  console.log('🧪 Task 8: Read Price Functionality - Comprehensive Tests\n');

  let testsPassed = 0;
  let totalTests = 0;

  // Test setup
  const mockConnection = new MockConnection();
  const programId = new PublicKey('11111111111111111111111111111112'); // System program
  const priceReader = new PriceReader(mockConnection, programId);

  // Mock account addresses
  const validAccountKey = Keypair.generate().publicKey;
  const invalidAccountKey = Keypair.generate().publicKey;
  const nonExistentAccountKey = Keypair.generate().publicKey;

  // Setup mock accounts
  const validAccountInfo = {
    data: Buffer.alloc(1000), // Mock serialized data
    owner: programId,
    lamports: 1000000,
    slot: 12345,
    executable: false
  };

  const invalidAccountInfo = {
    data: Buffer.alloc(100), // Invalid data
    owner: Keypair.generate().publicKey, // Wrong owner
    lamports: 1000000,
    slot: 12345,
    executable: false
  };

  mockConnection.setMockAccount(validAccountKey, validAccountInfo);
  mockConnection.setMockAccount(invalidAccountKey, invalidAccountInfo);

  /**
   * Test helper function
   */
  function runTest(testName, testFunction) {
    totalTests++;
    try {
      const result = testFunction();
      if (result instanceof Promise) {
        return result.then(() => {
          console.log(`✅ ${testName}`);
          testsPassed++;
        }).catch(error => {
          console.log(`❌ ${testName}: ${error.message}`);
        });
      } else {
        console.log(`✅ ${testName}`);
        testsPassed++;
      }
    } catch (error) {
      console.log(`❌ ${testName}: ${error.message}`);
    }
  }

  // Test 1: Read Current Price - Valid Account
  await runTest('Read Current Price - Valid Account', async () => {
    const priceData = await priceReader.readCurrentPrice(validAccountKey);
    
    if (!priceData.price || !priceData.confidence) {
      throw new Error('Missing required price data fields');
    }
    
    if (typeof priceData.age !== 'number') {
      throw new Error('Age should be a number');
    }
    
    if (!Array.isArray(priceData.sources)) {
      throw new Error('Sources should be an array');
    }
  });

  // Test 2: Read Current Price - Non-existent Account
  await runTest('Read Current Price - Non-existent Account', async () => {
    try {
      await priceReader.readCurrentPrice(nonExistentAccountKey);
      throw new Error('Should have thrown error for non-existent account');
    } catch (error) {
      if (!error.message.includes('Account not found')) {
        throw new Error('Wrong error message for non-existent account');
      }
    }
  });

  // Test 3: Read Price History
  await runTest('Read Price History', async () => {
    const history = await priceReader.readPriceHistory(validAccountKey, 10);
    
    if (!Array.isArray(history)) {
      throw new Error('History should be an array');
    }
    
    // Check history entry structure
    if (history.length > 0) {
      const entry = history[0];
      if (!entry.price || !entry.timestamp) {
        throw new Error('History entry missing required fields');
      }
    }
  });

  // Test 4: Read Account Statistics
  await runTest('Read Account Statistics', async () => {
    const stats = await priceReader.readAccountStatistics(validAccountKey);
    
    if (!stats.account || !stats.currentPrice || !stats.tokenPair) {
      throw new Error('Missing required statistics sections');
    }
    
    if (!stats.account.address || !stats.account.isInitialized) {
      throw new Error('Missing account metadata');
    }
  });

  // Test 5: Read Multiple Prices
  await runTest('Read Multiple Prices', async () => {
    const addresses = [validAccountKey, nonExistentAccountKey, validAccountKey];
    const results = await priceReader.readMultiplePrices(addresses);
    
    if (!results.successful || !results.failed) {
      throw new Error('Missing successful/failed arrays');
    }
    
    if (results.totalRequested !== 3) {
      throw new Error('Incorrect total requested count');
    }
    
    if (results.successCount + results.failureCount !== results.totalRequested) {
      throw new Error('Success + failure count should equal total');
    }
  });

  // Test 6: Validate Price Feed Account - Valid
  await runTest('Validate Price Feed Account - Valid', async () => {
    const validation = await priceReader.validatePriceFeedAccount(validAccountKey);
    
    if (!validation.exists || !validation.isValid) {
      throw new Error('Valid account should pass validation');
    }
    
    if (!validation.isInitialized || !validation.tokenPair) {
      throw new Error('Missing validation details');
    }
  });

  // Test 7: Validate Price Feed Account - Invalid Owner
  await runTest('Validate Price Feed Account - Invalid Owner', async () => {
    const validation = await priceReader.validatePriceFeedAccount(invalidAccountKey);
    
    if (!validation.exists) {
      throw new Error('Account should exist');
    }
    
    if (validation.isValid) {
      throw new Error('Account with wrong owner should be invalid');
    }
    
    if (!validation.error.includes('not owned by program')) {
      throw new Error('Wrong error message for invalid owner');
    }
  });

  // Test 8: Validate Price Feed Account - Non-existent
  await runTest('Validate Price Feed Account - Non-existent', async () => {
    const validation = await priceReader.validatePriceFeedAccount(nonExistentAccountKey);
    
    if (validation.exists || validation.isValid) {
      throw new Error('Non-existent account should fail validation');
    }
    
    if (!validation.error.includes('does not exist')) {
      throw new Error('Wrong error message for non-existent account');
    }
  });

  // Test 9: Cache Functionality
  await runTest('Cache Functionality', async () => {
    // Clear cache first
    priceReader.clearCache();
    
    // First read (should hit blockchain)
    const initialCallCount = mockConnection.callCount;
    await priceReader.readCurrentPrice(validAccountKey, true);
    const afterFirstRead = mockConnection.callCount;
    
    // Second read (should hit cache)
    await priceReader.readCurrentPrice(validAccountKey, true);
    const afterSecondRead = mockConnection.callCount;
    
    if (afterSecondRead !== afterFirstRead) {
      throw new Error('Second read should have used cache');
    }
    
    const metrics = priceReader.getMetrics();
    if (metrics.cacheHits === 0) {
      throw new Error('Cache hits should be greater than 0');
    }
  });

  // Test 10: Performance Metrics
  await runTest('Performance Metrics', async () => {
    const metrics = priceReader.getMetrics();
    
    if (typeof metrics.totalReads !== 'number') {
      throw new Error('Total reads should be a number');
    }
    
    if (typeof metrics.successRate !== 'number') {
      throw new Error('Success rate should be a number');
    }
    
    if (typeof metrics.averageReadTime !== 'number') {
      throw new Error('Average read time should be a number');
    }
    
    if (metrics.successRate < 0 || metrics.successRate > 100) {
      throw new Error('Success rate should be between 0 and 100');
    }
  });

  // Test 11: Cache Expiration
  await runTest('Cache Expiration', async () => {
    // Set a very short cache timeout for testing
    const shortCacheReader = new PriceReader(mockConnection, programId);
    shortCacheReader.cacheTimeout = 10; // 10ms
    
    // Read data
    await shortCacheReader.readCurrentPrice(validAccountKey, true);
    
    // Wait for cache to expire
    await new Promise(resolve => setTimeout(resolve, 20));
    
    // Read again - should hit blockchain
    const initialCallCount = mockConnection.callCount;
    await shortCacheReader.readCurrentPrice(validAccountKey, true);
    const afterExpiredRead = mockConnection.callCount;
    
    if (afterExpiredRead === initialCallCount) {
      throw new Error('Expired cache should have triggered new blockchain read');
    }
  });

  // Test 12: Error Handling - Invalid Address Format
  await runTest('Error Handling - Invalid Address Format', async () => {
    try {
      await priceReader.readCurrentPrice('invalid-address-format');
      throw new Error('Should have thrown error for invalid address');
    } catch (error) {
      if (!error.message.includes('Invalid public key')) {
        // This might pass through to account not found, which is also acceptable
        if (!error.message.includes('Failed to read current price')) {
          throw new Error('Should have thrown appropriate error for invalid address');
        }
      }
    }
  });

  // Test 13: Utility Functions - Format Price Data
  await runTest('Utility Functions - Format Price Data', () => {
    const mockPriceData = {
      price: 175.5,
      confidence: 0.95,
      age: 65000, // 65 seconds
      sources: ['okx', 'coingecko'],
      isStale: false
    };
    
    const formatted = PriceReaderUtils.formatPriceData(mockPriceData);
    
    if (!formatted.price.includes('$175.5000')) {
      throw new Error('Price formatting incorrect');
    }
    
    if (!formatted.confidence.includes('95.00%')) {
      throw new Error('Confidence formatting incorrect');
    }
    
    if (!formatted.age.includes('1m')) {
      throw new Error('Age formatting incorrect');
    }
    
    if (formatted.sources !== 'okx, coingecko') {
      throw new Error('Sources formatting incorrect');
    }
  });

  // Test 14: Utility Functions - Calculate Price Change
  await runTest('Utility Functions - Calculate Price Change', () => {
    const change = PriceReaderUtils.calculatePriceChange(175.5, 170.0);
    
    if (Math.abs(change.absolute - 5.5) > 0.001) {
      throw new Error('Absolute change calculation incorrect');
    }
    
    if (Math.abs(change.percentage - 3.235) > 0.01) {
      throw new Error('Percentage change calculation incorrect');
    }
    
    if (change.direction !== 'up') {
      throw new Error('Direction calculation incorrect');
    }
    
    if (!change.formatted.includes('+5.5000') || !change.formatted.includes('+3.24%')) {
      throw new Error('Formatted change incorrect');
    }
  });

  // Test 15: Utility Functions - Format Age
  await runTest('Utility Functions - Format Age', () => {
    if (PriceReaderUtils.formatAge(500) !== '500ms') {
      throw new Error('Milliseconds formatting incorrect');
    }
    
    if (PriceReaderUtils.formatAge(5000) !== '5s') {
      throw new Error('Seconds formatting incorrect');
    }
    
    if (PriceReaderUtils.formatAge(65000) !== '1m') {
      throw new Error('Minutes formatting incorrect');
    }
    
    if (PriceReaderUtils.formatAge(3700000) !== '1h') {
      throw new Error('Hours formatting incorrect');
    }
  });

  // Test 16: Concurrent Reads
  await runTest('Concurrent Reads', async () => {
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(priceReader.readCurrentPrice(validAccountKey));
    }
    
    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    if (successful !== 5) {
      throw new Error(`Expected 5 successful concurrent reads, got ${successful}`);
    }
  });

  // Test 17: Large History Read
  await runTest('Large History Read', async () => {
    const history = await priceReader.readPriceHistory(validAccountKey, 1000);
    
    if (!Array.isArray(history)) {
      throw new Error('History should be an array');
    }
    
    // Should handle large limits gracefully
    if (history.length > 1000) {
      throw new Error('History should respect limit parameter');
    }
  });

  // Test 18: Memory Management
  await runTest('Memory Management', async () => {
    const initialCacheSize = priceReader.cache.size;
    
    // Perform multiple reads with different keys
    for (let i = 0; i < 10; i++) {
      const tempKey = Keypair.generate().publicKey;
      mockConnection.setMockAccount(tempKey, validAccountInfo);
      try {
        await priceReader.readCurrentPrice(tempKey);
      } catch (error) {
        // Some may fail, that's ok for this test
      }
    }
    
    // Clear cache
    priceReader.clearCache();
    const finalCacheSize = priceReader.cache.size;
    
    if (finalCacheSize !== 0) {
      throw new Error('Cache should be empty after clearing');
    }
  });

  // Print test results
  console.log(`\n📊 Test Results: ${testsPassed}/${totalTests} tests passed`);
  
  if (testsPassed === totalTests) {
    console.log('✅ All tests passed! Read Price Functionality is working correctly.');
  } else {
    console.log(`⚠️  ${totalTests - testsPassed} tests failed.`);
  }

  // Print performance metrics
  const finalMetrics = priceReader.getMetrics();
  console.log('\n📈 Final Performance Metrics:');
  console.log(`   Total reads: ${finalMetrics.totalReads}`);
  console.log(`   Successful reads: ${finalMetrics.successfulReads}`);
  console.log(`   Failed reads: ${finalMetrics.failedReads}`);
  console.log(`   Success rate: ${finalMetrics.successRate.toFixed(2)}%`);
  console.log(`   Cache hits: ${finalMetrics.cacheHits}`);
  console.log(`   Cache hit rate: ${finalMetrics.cacheHitRate.toFixed(2)}%`);
  console.log(`   Average read time: ${finalMetrics.averageReadTime.toFixed(2)}ms`);
  console.log(`   Cache size: ${finalMetrics.cacheSize}`);

  return {
    testsPassed,
    totalTests,
    successRate: (testsPassed / totalTests) * 100,
    metrics: finalMetrics
  };
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runReadPriceFunctionalityTests()
    .then(results => {
      console.log(`\n🎉 Task 8 Testing Completed!`);
      console.log(`📊 Overall Success Rate: ${results.successRate.toFixed(2)}%`);
      process.exit(results.testsPassed === results.totalTests ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

export { runReadPriceFunctionalityTests };
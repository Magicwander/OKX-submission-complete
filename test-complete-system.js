#!/usr/bin/env node

/**
 * Complete System Integration Test
 * Tests all components working together:
 * 1. OKX DEX API integration
 * 2. Solana keeper service
 * 3. Task 6: PriceFeedAccount structure
 * 4. Task 7: update_price instruction
 * 5. End-to-end price feed workflow
 */

import OKXDexAPI from './okx-dex-api.js';
import fs from 'fs';
import path from 'path';

// Test results tracking
const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    details: []
};

function logTest(name, passed, details = '') {
    testResults.total++;
    if (passed) {
        testResults.passed++;
        console.log(`✅ ${name}`);
    } else {
        testResults.failed++;
        console.log(`❌ ${name}: ${details}`);
    }
    testResults.details.push({ name, passed, details });
}

async function testOKXDexAPI() {
    console.log('\n🧪 Testing OKX DEX API Integration');
    console.log('==================================================');
    
    try {
        const api = new OKXDexAPI();
        
        // Test 1: API initialization
        logTest('OKX API Initialization', api !== null);
        
        // Test 2: Get ticker data
        const ticker = await api.getTicker('BTC-USDT');
        logTest('Get BTC-USDT Ticker', 
            ticker && ticker.lastPrice && parseFloat(ticker.lastPrice) > 0,
            ticker ? `Price: $${ticker.lastPrice}` : 'No ticker data'
        );
        
        // Test 3: Get multiple tickers
        const tickers = await api.getTickers(['BTC-USDT', 'ETH-USDT', 'SOL-USDC']);
        logTest('Get Multiple Tickers', 
            tickers && tickers.length >= 2,
            `Received ${tickers ? tickers.length : 0} tickers`
        );
        
        // Test 4: Get order book
        const orderbook = await api.getOrderBook('BTC-USDT');
        logTest('Get Order Book', 
            orderbook && orderbook.bids && orderbook.asks,
            orderbook ? `Bids: ${orderbook.bids.length}, Asks: ${orderbook.asks.length}` : 'No orderbook'
        );
        
        // Test 5: Get 24hr stats
        const stats = await api.get24hStats('SPOT');
        logTest('Get 24hr Statistics', 
            stats && stats.length > 0,
            stats ? `Found ${stats.length} trading pairs` : 'No stats'
        );
        
        return true;
    } catch (error) {
        logTest('OKX API Integration', false, error.message);
        return false;
    }
}

async function testSolanaKeeperService() {
    console.log('\n🧪 Testing Solana Keeper Service');
    console.log('==================================================');
    
    try {
        // Import keeper service
        const KeeperService = (await import('./solana-keeper-service/keeper-service.js')).default;
        
        // Test 1: Keeper service initialization
        const config = {
            rpcUrl: 'https://api.devnet.solana.com',
            updateInterval: 10000,
            priceThreshold: 0.01,
            tokens: ['BTC/USDT', 'ETH/USDT', 'SOL/USDC'],
            sources: ['okx', 'coingecko']
        };
        
        const keeper = new KeeperService(config);
        
        // Initialize with a test wallet
        const { Keypair } = await import('@solana/web3.js');
        const testWallet = Keypair.generate();
        await keeper.initialize(testWallet);
        
        logTest('Keeper Service Initialization', keeper !== null);
        
        // Test 2: Price fetching
        const prices = await keeper.fetchPrices();
        logTest('Price Fetching', 
            prices && prices.size > 0,
            `Fetched ${prices ? prices.size : 0} prices`
        );
        
        // Test 3: Price change detection
        if (prices && prices.has('SOL/USDC')) {
            const solPrice = prices.get('SOL/USDC');
            const shouldUpdate1 = keeper.shouldUpdatePrice('SOL/USDC', solPrice);
            const shouldUpdate2 = keeper.shouldUpdatePrice('SOL/USDC', solPrice);
            logTest('Price Change Detection', 
                shouldUpdate1 === true && shouldUpdate2 === false,
                `First: ${shouldUpdate1}, Second: ${shouldUpdate2}`
            );
        }
        
        // Test 4: Transaction creation
        if (prices && prices.has('BTC/USDT')) {
            const btcPrice = prices.get('BTC/USDT');
            const transaction = await keeper.createPriceUpdateTransaction('BTC/USDT', btcPrice);
            logTest('Transaction Creation', 
                transaction && transaction.instructions && transaction.instructions.length > 0,
                `Instructions: ${transaction ? transaction.instructions.length : 0}`
            );
        }
        
        return true;
    } catch (error) {
        logTest('Keeper Service Integration', false, error.message);
        return false;
    }
}

async function testPriceFeedAccount() {
    console.log('\n🧪 Testing Task 6: PriceFeedAccount Structure');
    console.log('==================================================');
    
    try {
        // Run the existing price feed account tests
        const testModule = await import('./solana-keeper-service/test-price-feed-account.js');
        const result = await testModule.default();
        logTest('PriceFeedAccount Tests', result, 'All 15 tests executed');
        return result;
    } catch (error) {
        logTest('PriceFeedAccount Tests', false, error.message);
        return false;
    }
}

async function testUpdatePriceInstruction() {
    console.log('\n🧪 Testing Task 7: Update Price Instruction');
    console.log('==================================================');
    
    try {
        // Run the existing update price instruction tests
        const testModule = await import('./solana-keeper-service/test-update-price-instruction.js');
        const result = await testModule.runUpdatePriceInstructionTests();
        logTest('Update Price Instruction Tests', result, '18 tests executed');
        return result;
    } catch (error) {
        logTest('Update Price Instruction Tests', false, error.message);
        return false;
    }
}

async function testEndToEndWorkflow() {
    console.log('\n🧪 Testing End-to-End Price Feed Workflow');
    console.log('==================================================');
    
    try {
        // Test 1: OKX API → Keeper Service → Price Update
        const api = new OKXDexAPI();
        const KeeperService = (await import('./solana-keeper-service/keeper-service.js')).default;
        
        // Get real price data from OKX
        const ticker = await api.getTicker('BTC-USDT');
        logTest('E2E: Fetch Real Price Data', 
            ticker && ticker.lastPrice,
            `BTC Price: $${ticker ? ticker.lastPrice : 'N/A'}`
        );
        
        // Initialize keeper with real data
        const keeper = new KeeperService({
            rpcUrl: 'https://api.devnet.solana.com',
            updateInterval: 10000,
            priceThreshold: 0.01,
            tokens: ['BTC/USDT'],
            sources: ['okx']
        });
        
        // Initialize with a test wallet
        const { Keypair } = await import('@solana/web3.js');
        const testWallet = Keypair.generate();
        await keeper.initialize(testWallet);
        
        // Process price through keeper
        const prices = await keeper.fetchPrices();
        logTest('E2E: Process Through Keeper', 
            prices && prices.has('BTC/USDT'),
            `Processed price: $${prices && prices.has('BTC/USDT') ? prices.get('BTC/USDT').price : 'N/A'}`
        );
        
        // Create update instruction
        if (prices && prices.has('BTC/USDT')) {
            const btcPrice = prices.get('BTC/USDT');
            const transaction = await keeper.createPriceUpdateTransaction('BTC/USDT', btcPrice);
            logTest('E2E: Create Update Transaction', 
                transaction && transaction.instructions,
                `Transaction ready with ${transaction ? transaction.instructions.length : 0} instructions`
            );
        }
        
        return true;
    } catch (error) {
        logTest('End-to-End Workflow', false, error.message);
        return false;
    }
}

async function testSystemPerformance() {
    console.log('\n🧪 Testing System Performance');
    console.log('==================================================');
    
    try {
        const api = new OKXDexAPI();
        
        // Test 1: API response time
        const start1 = Date.now();
        await api.getTicker('BTC-USDT');
        const apiTime = Date.now() - start1;
        logTest('API Response Time', 
            apiTime < 2000,
            `${apiTime}ms (target: <2000ms)`
        );
        
        // Test 2: Batch price fetching
        const start2 = Date.now();
        await api.getTickers(['BTC-USDT', 'ETH-USDT', 'SOL-USDC']);
        const batchTime = Date.now() - start2;
        logTest('Batch Price Fetching', 
            batchTime < 3000,
            `${batchTime}ms for 3 tokens (target: <3000ms)`
        );
        
        // Test 3: Memory usage check
        const memUsage = process.memoryUsage();
        logTest('Memory Usage', 
            memUsage.heapUsed < 100 * 1024 * 1024, // 100MB
            `Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`
        );
        
        return true;
    } catch (error) {
        logTest('System Performance', false, error.message);
        return false;
    }
}

async function generateTestReport() {
    console.log('\n📊 Generating Test Report');
    console.log('==================================================');
    
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            total: testResults.total,
            passed: testResults.passed,
            failed: testResults.failed,
            successRate: `${Math.round((testResults.passed / testResults.total) * 100)}%`
        },
        details: testResults.details,
        environment: {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch
        }
    };
    
    // Save report to file
    const reportPath = './test-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📋 Test Report Summary:`);
    console.log(`   Total Tests: ${report.summary.total}`);
    console.log(`   Passed: ${report.summary.passed}`);
    console.log(`   Failed: ${report.summary.failed}`);
    console.log(`   Success Rate: ${report.summary.successRate}`);
    console.log(`   Report saved to: ${reportPath}`);
    
    return report;
}

async function runCompleteSystemTest() {
    console.log('🚀 Complete System Integration Test');
    console.log('==================================================');
    console.log('Testing all components of the OKX submission:');
    console.log('• OKX DEX API integration');
    console.log('• Solana keeper service');
    console.log('• Task 6: PriceFeedAccount structure');
    console.log('• Task 7: update_price instruction');
    console.log('• End-to-end workflow');
    console.log('• System performance');
    console.log('==================================================\n');
    
    try {
        // Run all test suites
        await testOKXDexAPI();
        await testSolanaKeeperService();
        await testPriceFeedAccount();
        await testUpdatePriceInstruction();
        await testEndToEndWorkflow();
        await testSystemPerformance();
        
        // Generate final report
        const report = await generateTestReport();
        
        console.log('\n🎉 Complete System Test Finished!');
        console.log('==================================================');
        
        if (report.summary.successRate === '100%') {
            console.log('🏆 ALL TESTS PASSED! System is ready for production.');
        } else if (parseInt(report.summary.successRate) >= 80) {
            console.log('✅ Most tests passed. System is functional with minor issues.');
        } else {
            console.log('⚠️  Some critical tests failed. Review required.');
        }
        
        return report.summary.successRate === '100%';
        
    } catch (error) {
        console.error('❌ Test execution failed:', error);
        return false;
    }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runCompleteSystemTest()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test execution failed:', error);
            process.exit(1);
        });
}

export { runCompleteSystemTest };
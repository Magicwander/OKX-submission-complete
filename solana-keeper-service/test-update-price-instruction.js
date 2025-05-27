/**
 * Test Suite for Task 7: Update Price Instruction
 * 
 * Comprehensive tests for the update_price instruction implementation
 * including authority validation, price updates, and error handling.
 */

import { 
    PublicKey, 
    Keypair,
    SYSVAR_CLOCK_PUBKEY 
} from '@solana/web3.js';
import { 
    UpdatePriceInstruction,
    UpdatePriceInstructionData,
    PriceUpdateInstructionFactory,
    UPDATE_PRICE_INSTRUCTION_SCHEMA,
    ProgramError
} from './update-price-instruction.js';
import { PriceFeedAccount } from './price-feed-account.js';
import { serialize, deserialize } from 'borsh';
import Decimal from 'decimal.js';

/**
 * Test utilities
 */
class TestUtils {
    static generateKeypair() {
        return Keypair.generate();
    }

    static createMockPriceFeedAccount(authority) {
        const account = new PriceFeedAccount();
        account.initialize(
            { pairId: 'BTC/USDT', baseSymbol: 'BTC', quoteSymbol: 'USDT', baseDecimals: 8, quoteDecimals: 6 },
            authority.publicKey,
            new PublicKey('11111111111111111111111111111111') // System Program as oracle program
        );
        return account;
    }

    static getCurrentTimestamp() {
        return Math.floor(Date.now() / 1000);
    }

    static getCurrentSlot() {
        return Date.now();
    }
}

/**
 * Test runner
 */
async function runUpdatePriceInstructionTests() {
    console.log('🧪 Update Price Instruction Tests\n');

    let passedTests = 0;
    let totalTests = 0;

    function test(name, testFn) {
        totalTests++;
        try {
            testFn();
            console.log(`✅ ${name}`);
            passedTests++;
        } catch (error) {
            console.log(`❌ ${name}: ${error.message}`);
        }
    }

    // Test setup
    const programId = '11111111111111111111111111111112';
    const instruction = new UpdatePriceInstruction(programId);
    const factory = new PriceUpdateInstructionFactory(programId);
    
    const authority = TestUtils.generateKeypair();
    const unauthorizedUser = TestUtils.generateKeypair();
    const priceFeedAccount = TestUtils.generateKeypair();
    const mockAccount = TestUtils.createMockPriceFeedAccount(authority);

    // Test 1: Instruction Creation
    test('Instruction Creation', () => {
        const params = {
            priceFeedAccount: priceFeedAccount.publicKey,
            authority: authority.publicKey,
            price: '50000.50',
            confidence: '0.95',
            slot: TestUtils.getCurrentSlot(),
            timestamp: TestUtils.getCurrentTimestamp(),
            sources: ['okx', 'binance']
        };

        const ix = instruction.createUpdatePriceInstruction(params);
        
        if (!ix.programId.equals(new PublicKey(programId))) {
            throw new Error('Invalid program ID');
        }
        
        if (ix.keys.length !== 3) {
            throw new Error('Invalid number of accounts');
        }
        
        if (!ix.keys[0].pubkey.equals(priceFeedAccount.publicKey)) {
            throw new Error('Invalid price feed account');
        }
        
        if (!ix.keys[1].pubkey.equals(authority.publicKey)) {
            throw new Error('Invalid authority');
        }
        
        if (!ix.keys[1].isSigner) {
            throw new Error('Authority must be signer');
        }
    });

    // Test 2: Instruction Data Serialization
    test('Instruction Data Serialization', () => {
        const instructionData = new UpdatePriceInstructionData({
            instruction: 0,
            price: '45000.25',
            confidence: '0.90',
            slot: 12345n,
            timestamp: 1640995200n,
            sources: ['okx', 'coingecko']
        });

        const serialized = serialize(UPDATE_PRICE_INSTRUCTION_SCHEMA, instructionData);
        const deserialized = deserialize(UPDATE_PRICE_INSTRUCTION_SCHEMA, serialized);

        if (deserialized.instruction !== 0) {
            throw new Error('Instruction type mismatch');
        }
        
        if (deserialized.price !== '45000.25') {
            throw new Error('Price mismatch');
        }
        
        if (deserialized.confidence !== '0.90') {
            throw new Error('Confidence mismatch');
        }
        
        if (deserialized.slot !== 12345n) {
            throw new Error('Slot mismatch');
        }
        
        if (deserialized.sources.length !== 2) {
            throw new Error('Sources count mismatch');
        }
    });

    // Test 3: Parameter Validation - Valid Parameters
    test('Parameter Validation - Valid Parameters', () => {
        const params = {
            priceFeedAccount: priceFeedAccount.publicKey,
            authority: authority.publicKey,
            price: '50000.50',
            confidence: '0.95',
            slot: TestUtils.getCurrentSlot(),
            timestamp: TestUtils.getCurrentTimestamp(),
            sources: ['okx', 'binance']
        };

        // Should not throw
        instruction.validateInstructionParams(params);
    });

    // Test 4: Parameter Validation - Invalid Price
    test('Parameter Validation - Invalid Price', () => {
        const params = {
            priceFeedAccount: priceFeedAccount.publicKey,
            authority: authority.publicKey,
            price: '-100',
            confidence: '0.95',
            slot: TestUtils.getCurrentSlot(),
            timestamp: TestUtils.getCurrentTimestamp(),
            sources: ['okx']
        };

        try {
            instruction.validateInstructionParams(params);
            throw new Error('Should have thrown for negative price');
        } catch (error) {
            if (!error.message.includes('4098') && !error.message.includes('Price must be positive')) {
                throw new Error('Wrong error type for invalid price');
            }
        }
    });

    // Test 5: Parameter Validation - Invalid Confidence
    test('Parameter Validation - Invalid Confidence', () => {
        const params = {
            priceFeedAccount: priceFeedAccount.publicKey,
            authority: authority.publicKey,
            price: '50000',
            confidence: '1.5', // > 1.0
            slot: TestUtils.getCurrentSlot(),
            timestamp: TestUtils.getCurrentTimestamp(),
            sources: ['okx']
        };

        try {
            instruction.validateInstructionParams(params);
            throw new Error('Should have thrown for invalid confidence');
        } catch (error) {
            if (!error.message.includes('4100') && !error.message.includes('Confidence must be between')) {
                throw new Error('Wrong error type for invalid confidence');
            }
        }
    });

    // Test 6: Parameter Validation - Stale Data
    test('Parameter Validation - Stale Data', () => {
        const params = {
            priceFeedAccount: priceFeedAccount.publicKey,
            authority: authority.publicKey,
            price: '50000',
            confidence: '0.95',
            slot: TestUtils.getCurrentSlot(),
            timestamp: TestUtils.getCurrentTimestamp() - 600, // 10 minutes old
            sources: ['okx']
        };

        try {
            instruction.validateInstructionParams(params);
            throw new Error('Should have thrown for stale data');
        } catch (error) {
            if (!error.message.includes('4104') && !error.message.includes('Price data is too old')) {
                throw new Error('Wrong error type for stale data');
            }
        }
    });

    // Test 7: Authority Validation - Valid Authority
    test('Authority Validation - Valid Authority', () => {
        const instructionData = new UpdatePriceInstructionData({
            instruction: 0,
            price: '50000',
            confidence: '0.95',
            slot: TestUtils.getCurrentSlot(),
            timestamp: TestUtils.getCurrentTimestamp(),
            sources: ['okx']
        });

        const result = instruction.processUpdatePriceInstruction({
            account: mockAccount,
            authority: authority.publicKey,
            instructionData: instructionData
        });

        if (!result.success) {
            throw new Error(`Processing failed: ${result.error}`);
        }
        
        if (result.slot !== instructionData.slot) {
            throw new Error('Slot not updated correctly');
        }
    });

    // Test 8: Authority Validation - Unauthorized User
    test('Authority Validation - Unauthorized User', () => {
        const instructionData = new UpdatePriceInstructionData({
            instruction: 0,
            price: '50000',
            confidence: '0.95',
            slot: TestUtils.getCurrentSlot(),
            timestamp: TestUtils.getCurrentTimestamp(),
            sources: ['okx']
        });

        const result = instruction.processUpdatePriceInstruction({
            account: mockAccount,
            authority: unauthorizedUser.publicKey,
            instructionData: instructionData
        });

        if (result.success) {
            throw new Error('Should have failed for unauthorized user');
        }
        
        if (!result.error.includes('4097') && !result.error.includes('Invalid authority')) {
            throw new Error('Wrong error type for unauthorized access');
        }
    });

    // Test 9: Price Update Processing
    test('Price Update Processing', () => {
        const oldPrice = mockAccount.currentPrice.price;
        
        const instructionData = new UpdatePriceInstructionData({
            instruction: 0,
            price: '51000.75',
            confidence: '0.92',
            slot: TestUtils.getCurrentSlot(),
            timestamp: TestUtils.getCurrentTimestamp(),
            sources: ['okx', 'binance']
        });

        const result = instruction.processUpdatePriceInstruction({
            account: mockAccount,
            authority: authority.publicKey,
            instructionData: instructionData
        });

        if (!result.success) {
            throw new Error(`Price update failed: ${result.error}`);
        }
        
        if (mockAccount.currentPrice.price.equals(oldPrice)) {
            throw new Error('Price was not updated');
        }
        
        if (!mockAccount.currentPrice.price.equals(new Decimal('51000.75'))) {
            throw new Error('Price not set correctly');
        }
    });

    // Test 10: Batch Instructions Creation
    test('Batch Instructions Creation', () => {
        const priceUpdates = [
            {
                priceFeedAccount: TestUtils.generateKeypair().publicKey,
                symbol: 'BTC/USDT',
                price: '50000',
                confidence: '0.95',
                slot: TestUtils.getCurrentSlot(),
                timestamp: TestUtils.getCurrentTimestamp(),
                sources: ['okx', 'binance']
            },
            {
                priceFeedAccount: TestUtils.generateKeypair().publicKey,
                symbol: 'ETH/USDT',
                price: '3000',
                confidence: '0.90',
                slot: TestUtils.getCurrentSlot(),
                timestamp: TestUtils.getCurrentTimestamp(),
                sources: ['okx', 'coingecko']
            }
        ];

        const instructions = instruction.createBatchUpdateInstructions({
            priceUpdates: priceUpdates,
            authority: authority.publicKey
        });

        if (instructions.length !== 2) {
            throw new Error('Wrong number of instructions created');
        }
        
        for (const ix of instructions) {
            if (!ix.programId.equals(new PublicKey(programId))) {
                throw new Error('Invalid program ID in batch instruction');
            }
        }
    });

    // Test 11: Factory - Validated Instruction Creation
    test('Factory - Validated Instruction Creation', () => {
        const params = {
            priceFeedAccount: priceFeedAccount.publicKey,
            authority: authority.publicKey,
            price: '50000.50',
            confidence: '0.95',
            slot: TestUtils.getCurrentSlot(),
            timestamp: TestUtils.getCurrentTimestamp(),
            sources: ['okx', 'binance']
        };

        const ix = factory.createValidatedInstruction(params);
        
        if (!ix.programId.equals(new PublicKey(programId))) {
            throw new Error('Invalid program ID from factory');
        }
    });

    // Test 12: Factory - Keeper Integration
    test('Factory - Keeper Integration', () => {
        const params = {
            symbol: 'BTC/USDT',
            price: new Decimal('50000.50'),
            sources: [
                { name: 'okx', price: '50000' },
                { name: 'binance', price: '50001' }
            ],
            keeperWallet: authority.publicKey
        };

        const ix = factory.createKeeperInstruction(params);
        
        if (!ix.programId.equals(new PublicKey(programId))) {
            throw new Error('Invalid program ID from keeper instruction');
        }
        
        if (!ix.keys[1].pubkey.equals(authority.publicKey)) {
            throw new Error('Invalid keeper wallet in instruction');
        }
    });

    // Test 13: Confidence Calculation
    test('Confidence Calculation', () => {
        const sources = [
            { price: '50000' },
            { price: '50001' },
            { price: '49999' }
        ];

        const confidence = factory.calculateConfidence(sources);
        
        if (confidence.lt(0) || confidence.gt(1)) {
            throw new Error('Confidence out of valid range');
        }
        
        // Should be high confidence for close prices
        if (confidence.lt(0.8)) {
            throw new Error('Confidence too low for close prices');
        }
    });

    // Test 14: Compute Units Estimation
    test('Compute Units Estimation', () => {
        const computeUnits1 = instruction.estimateComputeUnits(1, false);
        const computeUnits2 = instruction.estimateComputeUnits(3, true);
        
        if (computeUnits1 >= computeUnits2) {
            throw new Error('More sources should require more compute units');
        }
        
        if (computeUnits2 > 200000) {
            throw new Error('Compute units exceed maximum');
        }
    });

    // Test 15: Instruction Size Calculation
    test('Instruction Size Calculation', () => {
        const sources = ['okx', 'binance', 'coingecko'];
        const size = instruction.getInstructionSize(sources);
        
        if (size <= 0) {
            throw new Error('Invalid instruction size');
        }
        
        // Should be reasonable size
        if (size > 1000) {
            throw new Error('Instruction size too large');
        }
    });

    // Test 16: Initialize Price Feed Instruction
    test('Initialize Price Feed Instruction', () => {
        const params = {
            priceFeedAccount: priceFeedAccount.publicKey,
            authority: authority.publicKey,
            payer: authority.publicKey,
            baseSymbol: 'BTC',
            quoteSymbol: 'USDT',
            baseDecimals: 8,
            quoteDecimals: 6
        };

        const ix = instruction.createInitializePriceFeedInstruction(params);
        
        if (!ix.programId.equals(new PublicKey(programId))) {
            throw new Error('Invalid program ID for initialize instruction');
        }
        
        if (ix.keys.length !== 5) {
            throw new Error('Invalid number of accounts for initialize instruction');
        }
    });

    // Test 17: Error Code Validation
    test('Error Code Validation', () => {
        const errorCodes = Object.values(ProgramError);
        
        if (errorCodes.length === 0) {
            throw new Error('No error codes defined');
        }
        
        // Check for unique error codes
        const uniqueCodes = new Set(errorCodes);
        if (uniqueCodes.size !== errorCodes.length) {
            throw new Error('Duplicate error codes found');
        }
    });

    // Test 18: Price Feed Address Derivation
    test('Price Feed Address Derivation', () => {
        const address1 = factory.derivePriceFeedAddress('BTC/USDT');
        const address2 = factory.derivePriceFeedAddress('BTC/USDT');
        const address3 = factory.derivePriceFeedAddress('ETH/USDT');
        
        if (!address1.equals(address2)) {
            throw new Error('Same symbol should derive same address');
        }
        
        if (address1.equals(address3)) {
            throw new Error('Different symbols should derive different addresses');
        }
    });

    // Results
    console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('✅ All tests passed! Update Price Instruction is working correctly.');
        return true;
    } else {
        console.log('❌ Some tests failed. Please check the implementation.');
        return false;
    }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runUpdatePriceInstructionTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test execution failed:', error);
            process.exit(1);
        });
}

export { runUpdatePriceInstructionTests };
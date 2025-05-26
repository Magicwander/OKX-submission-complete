/**
 * Task 7: Implement update_price Instruction
 * 
 * This module implements a Solana instruction for updating price data on-chain.
 * The instruction is callable only by the authority (keeper's wallet) and integrates
 * with the PriceFeedAccount structure from Task 6.
 * 
 * Features:
 * - Authority-only access control
 * - Price data validation and updates
 * - Integration with PriceFeedAccount structure
 * - Comprehensive error handling
 * - Performance optimization
 */

import { 
    PublicKey, 
    TransactionInstruction, 
    SystemProgram,
    SYSVAR_CLOCK_PUBKEY,
    SYSVAR_RENT_PUBKEY
} from '@solana/web3.js';
import { serialize, deserialize } from 'borsh';
import Decimal from 'decimal.js';

/**
 * Update Price Instruction Data Structure
 */
class UpdatePriceInstructionData {
    constructor(fields) {
        this.instruction = fields.instruction || 0; // 0 = UpdatePrice
        this.price = fields.price || '0';
        this.confidence = fields.confidence || '0';
        this.slot = fields.slot || 0;
        this.timestamp = fields.timestamp || 0;
        this.sources = fields.sources || [];
    }
}

/**
 * Borsh schema for UpdatePriceInstructionData
 */
const UPDATE_PRICE_INSTRUCTION_SCHEMA = new Map([
    [UpdatePriceInstructionData, {
        kind: 'struct',
        fields: [
            ['instruction', 'u8'],
            ['price', 'string'],
            ['confidence', 'string'],
            ['slot', 'u64'],
            ['timestamp', 'u64'],
            ['sources', ['string']]
        ]
    }]
]);

/**
 * Program Error Codes
 */
const ProgramError = {
    UNAUTHORIZED: 0x1001,
    INVALID_PRICE: 0x1002,
    STALE_DATA: 0x1003,
    INVALID_CONFIDENCE: 0x1004,
    ACCOUNT_NOT_INITIALIZED: 0x1005,
    INVALID_SLOT: 0x1006,
    INSUFFICIENT_SOURCES: 0x1007,
    PRICE_TOO_OLD: 0x1008
};

/**
 * Update Price Instruction Builder
 */
class UpdatePriceInstruction {
    constructor(programId) {
        this.programId = new PublicKey(programId);
        this.maxPriceAge = 300; // 5 minutes in seconds
        this.minConfidence = new Decimal('0.01'); // 1%
        this.minSources = 1;
    }

    /**
     * Create update price instruction
     * @param {Object} params - Instruction parameters
     * @param {PublicKey} params.priceFeedAccount - Price feed account to update
     * @param {PublicKey} params.authority - Authority (keeper) wallet
     * @param {string} params.price - New price value
     * @param {string} params.confidence - Price confidence level
     * @param {number} params.slot - Current slot number
     * @param {number} params.timestamp - Price timestamp
     * @param {string[]} params.sources - Price data sources
     * @returns {TransactionInstruction} The instruction
     */
    createUpdatePriceInstruction(params) {
        const {
            priceFeedAccount,
            authority,
            price,
            confidence,
            slot,
            timestamp,
            sources = []
        } = params;

        // Validate parameters
        this.validateInstructionParams(params);

        // Create instruction data
        const instructionData = new UpdatePriceInstructionData({
            instruction: 0, // UpdatePrice instruction
            price: price.toString(),
            confidence: confidence.toString(),
            slot: slot,
            timestamp: timestamp,
            sources: sources
        });

        // Serialize instruction data
        const data = Buffer.from(serialize(UPDATE_PRICE_INSTRUCTION_SCHEMA, instructionData));

        // Define accounts
        const accounts = [
            {
                pubkey: priceFeedAccount,
                isSigner: false,
                isWritable: true
            },
            {
                pubkey: authority,
                isSigner: true,
                isWritable: false
            },
            {
                pubkey: SYSVAR_CLOCK_PUBKEY,
                isSigner: false,
                isWritable: false
            }
        ];

        return new TransactionInstruction({
            keys: accounts,
            programId: this.programId,
            data: data
        });
    }

    /**
     * Create initialize price feed instruction
     * @param {Object} params - Initialization parameters
     * @param {PublicKey} params.priceFeedAccount - Price feed account to initialize
     * @param {PublicKey} params.authority - Authority wallet
     * @param {PublicKey} params.payer - Payer for account creation
     * @param {string} params.baseSymbol - Base token symbol
     * @param {string} params.quoteSymbol - Quote token symbol
     * @param {number} params.baseDecimals - Base token decimals
     * @param {number} params.quoteDecimals - Quote token decimals
     * @returns {TransactionInstruction} The instruction
     */
    createInitializePriceFeedInstruction(params) {
        const {
            priceFeedAccount,
            authority,
            payer,
            baseSymbol,
            quoteSymbol,
            baseDecimals,
            quoteDecimals
        } = params;

        // Create instruction data for initialization
        const instructionData = {
            instruction: 1, // InitializePriceFeed instruction
            baseSymbol: baseSymbol,
            quoteSymbol: quoteSymbol,
            baseDecimals: baseDecimals,
            quoteDecimals: quoteDecimals
        };

        const data = Buffer.from(JSON.stringify(instructionData));

        const accounts = [
            {
                pubkey: priceFeedAccount,
                isSigner: false,
                isWritable: true
            },
            {
                pubkey: authority,
                isSigner: true,
                isWritable: false
            },
            {
                pubkey: payer,
                isSigner: true,
                isWritable: true
            },
            {
                pubkey: SystemProgram.programId,
                isSigner: false,
                isWritable: false
            },
            {
                pubkey: SYSVAR_RENT_PUBKEY,
                isSigner: false,
                isWritable: false
            }
        ];

        return new TransactionInstruction({
            keys: accounts,
            programId: this.programId,
            data: data
        });
    }

    /**
     * Validate instruction parameters
     * @param {Object} params - Parameters to validate
     */
    validateInstructionParams(params) {
        const { price, confidence, slot, timestamp, sources, authority, priceFeedAccount } = params;

        // Validate required fields
        if (!priceFeedAccount) {
            throw new Error(`ProgramError: ${ProgramError.ACCOUNT_NOT_INITIALIZED} - Price feed account required`);
        }

        if (!authority) {
            throw new Error(`ProgramError: ${ProgramError.UNAUTHORIZED} - Authority required`);
        }

        // Validate price
        const priceDecimal = new Decimal(price);
        if (priceDecimal.lte(0)) {
            throw new Error(`ProgramError: ${ProgramError.INVALID_PRICE} - Price must be positive`);
        }

        // Validate confidence
        const confidenceDecimal = new Decimal(confidence);
        if (confidenceDecimal.lt(this.minConfidence) || confidenceDecimal.gt(1)) {
            throw new Error(`ProgramError: ${ProgramError.INVALID_CONFIDENCE} - Confidence must be between ${this.minConfidence} and 1`);
        }

        // Validate slot
        if (slot <= 0) {
            throw new Error(`ProgramError: ${ProgramError.INVALID_SLOT} - Slot must be positive`);
        }

        // Validate timestamp
        const currentTime = Math.floor(Date.now() / 1000);
        const priceAge = currentTime - timestamp;
        if (priceAge > this.maxPriceAge) {
            throw new Error(`ProgramError: ${ProgramError.PRICE_TOO_OLD} - Price data is too old (${priceAge}s > ${this.maxPriceAge}s)`);
        }

        // Validate sources
        if (sources.length < this.minSources) {
            throw new Error(`ProgramError: ${ProgramError.INSUFFICIENT_SOURCES} - At least ${this.minSources} source(s) required`);
        }
    }

    /**
     * Process update price instruction (simulated on-chain logic)
     * @param {Object} params - Processing parameters
     * @param {PriceFeedAccount} params.account - Price feed account
     * @param {PublicKey} params.authority - Instruction authority
     * @param {UpdatePriceInstructionData} params.instructionData - Instruction data
     * @returns {Object} Processing result
     */
    processUpdatePriceInstruction(params) {
        const { account, authority, instructionData } = params;

        try {
            // Verify authority
            if (!account.authority || account.authority.toString() !== authority.toString()) {
                throw new Error(`ProgramError: ${ProgramError.UNAUTHORIZED} - Invalid authority`);
            }

            // Verify account is initialized
            if (!account.isInitialized) {
                throw new Error(`ProgramError: ${ProgramError.ACCOUNT_NOT_INITIALIZED} - Account not initialized`);
            }

            // Validate instruction data
            this.validateInstructionParams({
                price: instructionData.price,
                confidence: instructionData.confidence,
                slot: instructionData.slot,
                timestamp: instructionData.timestamp,
                sources: instructionData.sources,
                authority: authority,
                priceFeedAccount: new PublicKey('11111111111111111111111111111111') // Dummy for validation
            });

            // Update price data
            const updateResult = account.updatePrice(
                new Decimal(instructionData.price),
                new Decimal(instructionData.confidence),
                instructionData.sources,
                instructionData.timestamp
            );

            // Update slot information
            account.lastUpdateSlot = instructionData.slot;

            return {
                success: true,
                priceUpdate: updateResult,
                slot: instructionData.slot,
                timestamp: instructionData.timestamp,
                sources: instructionData.sources.length
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: instructionData.timestamp
            };
        }
    }

    /**
     * Create price update transaction with multiple instructions
     * @param {Object} params - Transaction parameters
     * @param {Array} params.priceUpdates - Array of price update data
     * @param {PublicKey} params.authority - Authority wallet
     * @returns {Array} Array of instructions
     */
    createBatchUpdateInstructions(params) {
        const { priceUpdates, authority } = params;
        const instructions = [];

        for (const update of priceUpdates) {
            try {
                const instruction = this.createUpdatePriceInstruction({
                    priceFeedAccount: update.priceFeedAccount,
                    authority: authority,
                    price: update.price,
                    confidence: update.confidence,
                    slot: update.slot,
                    timestamp: update.timestamp,
                    sources: update.sources
                });

                instructions.push(instruction);
            } catch (error) {
                console.warn(`Failed to create instruction for ${update.symbol}: ${error.message}`);
            }
        }

        return instructions;
    }

    /**
     * Estimate compute units for price update
     * @param {number} sourcesCount - Number of price sources
     * @param {boolean} hasHistory - Whether updating price history
     * @returns {number} Estimated compute units
     */
    estimateComputeUnits(sourcesCount = 1, hasHistory = true) {
        let baseUnits = 5000; // Base instruction processing
        baseUnits += sourcesCount * 500; // Per source processing
        baseUnits += hasHistory ? 2000 : 0; // History update overhead
        
        return Math.min(baseUnits, 200000); // Cap at 200k CU
    }

    /**
     * Get instruction size in bytes
     * @param {Array} sources - Price sources array
     * @returns {number} Instruction size
     */
    getInstructionSize(sources = []) {
        const baseSize = 1 + 8 + 8 + 8 + 8; // instruction + price + confidence + slot + timestamp
        const sourcesSize = sources.reduce((total, source) => total + 4 + source.length, 4); // vec length + strings
        return baseSize + sourcesSize;
    }
}

/**
 * Price Update Instruction Factory
 */
class PriceUpdateInstructionFactory {
    constructor(programId) {
        this.instruction = new UpdatePriceInstruction(programId);
        this.defaultProgramId = 'PriceFeeds11111111111111111111111111111111';
    }

    /**
     * Create a complete price update instruction with validation
     * @param {Object} params - Instruction parameters
     * @returns {TransactionInstruction} Complete instruction
     */
    createValidatedInstruction(params) {
        // Add default program ID if not provided
        if (!params.programId) {
            params.programId = this.defaultProgramId;
        }

        // Validate and create instruction
        return this.instruction.createUpdatePriceInstruction(params);
    }

    /**
     * Create instruction for keeper service integration
     * @param {Object} params - Keeper service parameters
     * @param {string} params.symbol - Trading pair symbol
     * @param {Decimal} params.price - Current price
     * @param {Array} params.sources - Price sources
     * @param {PublicKey} params.keeperWallet - Keeper wallet
     * @returns {TransactionInstruction} Keeper instruction
     */
    createKeeperInstruction(params) {
        const { symbol, price, sources, keeperWallet } = params;
        
        // Generate price feed account address (deterministic)
        const priceFeedAccount = this.derivePriceFeedAddress(symbol);
        
        // Calculate confidence based on source agreement
        const confidence = this.calculateConfidence(sources);
        
        // Get current slot and timestamp
        const slot = Date.now(); // Simplified for demo
        const timestamp = Math.floor(Date.now() / 1000);

        return this.createValidatedInstruction({
            priceFeedAccount: priceFeedAccount,
            authority: keeperWallet,
            price: price.toString(),
            confidence: confidence.toString(),
            slot: slot,
            timestamp: timestamp,
            sources: sources.map(s => s.name || s)
        });
    }

    /**
     * Derive price feed account address
     * @param {string} symbol - Trading pair symbol
     * @returns {PublicKey} Derived address
     */
    derivePriceFeedAddress(symbol) {
        // Simplified derivation for demo - in production use PDA
        const seed = Buffer.from(`price_feed_${symbol.toLowerCase()}`);
        return new PublicKey(seed.slice(0, 32));
    }

    /**
     * Calculate confidence based on source agreement
     * @param {Array} sources - Price sources with data
     * @returns {Decimal} Confidence level
     */
    calculateConfidence(sources) {
        if (sources.length === 0) return new Decimal('0');
        if (sources.length === 1) return new Decimal('0.5');
        
        // Calculate price variance
        const prices = sources.map(s => new Decimal(s.price || s));
        const avgPrice = prices.reduce((sum, p) => sum.plus(p), new Decimal('0')).div(prices.length);
        
        const variance = prices.reduce((sum, p) => {
            const diff = p.minus(avgPrice).abs();
            return sum.plus(diff.div(avgPrice));
        }, new Decimal('0')).div(prices.length);
        
        // Higher agreement = higher confidence
        let confidence = new Decimal('1').minus(variance.times('10'));
        
        // Clamp between 0.1 and 0.95
        if (confidence.lt('0.1')) confidence = new Decimal('0.1');
        if (confidence.gt('0.95')) confidence = new Decimal('0.95');
        
        return confidence;
    }
}

export {
    UpdatePriceInstruction,
    UpdatePriceInstructionData,
    PriceUpdateInstructionFactory,
    UPDATE_PRICE_INSTRUCTION_SCHEMA,
    ProgramError
};
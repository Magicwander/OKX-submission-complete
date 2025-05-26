import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  Keypair,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import Decimal from 'decimal.js';

/**
 * Price Oracle Interface
 * 
 * Handles price oracle program interactions for storing and retrieving prices on Solana
 */
export default class PriceOracle {
  constructor(config = {}) {
    this.config = {
      rpcEndpoint: config.rpcEndpoint || 'https://api.devnet.solana.com',
      commitment: config.commitment || 'confirmed',
      oracleProgram: config.oracleProgram || null,
      enableLogging: config.enableLogging !== false,
      ...config
    };
    
    this.connection = new Connection(this.config.rpcEndpoint, this.config.commitment);
    this.priceAccounts = new Map();
    this.priceCache = new Map();
  }
  
  /**
   * Initialize price oracle with program ID
   */
  initialize(oracleProgramId) {
    if (typeof oracleProgramId === 'string') {
      this.config.oracleProgram = new PublicKey(oracleProgramId);
    } else {
      this.config.oracleProgram = oracleProgramId;
    }
    
    this.log(`Oracle initialized with program: ${this.config.oracleProgram.toString()}`);
  }
  
  /**
   * Create or get price account for a token pair
   */
  async getPriceAccount(tokenPair, authority) {
    if (this.priceAccounts.has(tokenPair)) {
      return this.priceAccounts.get(tokenPair);
    }
    
    if (!this.config.oracleProgram) {
      throw new Error('Oracle program not initialized');
    }
    
    try {
      // Generate deterministic price account address
      const [priceAccount, bump] = await PublicKey.findProgramAddress(
        [
          Buffer.from('price'),
          Buffer.from(tokenPair),
          authority.publicKey.toBuffer()
        ],
        this.config.oracleProgram
      );
      
      const accountInfo = {
        address: priceAccount,
        bump,
        tokenPair,
        authority: authority.publicKey
      };
      
      this.priceAccounts.set(tokenPair, accountInfo);
      this.log(`Price account for ${tokenPair}: ${priceAccount.toString()}`);
      
      return accountInfo;
      
    } catch (error) {
      this.log(`Failed to get price account for ${tokenPair}: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * Check if price account exists
   */
  async checkPriceAccount(priceAccount) {
    try {
      const accountInfo = await this.connection.getAccountInfo(priceAccount);
      return accountInfo !== null;
    } catch (error) {
      this.log(`Failed to check price account: ${error.message}`, 'error');
      return false;
    }
  }
  
  /**
   * Create price account initialization instruction
   */
  createInitializePriceAccountInstruction(tokenPair, priceAccount, authority, payer) {
    if (!this.config.oracleProgram) {
      throw new Error('Oracle program not initialized');
    }
    
    const initData = Buffer.concat([
      Buffer.from([0]), // Initialize instruction
      Buffer.from(tokenPair, 'utf8').subarray(0, 32), // Token pair (max 32 bytes)
      Buffer.alloc(32 - Math.min(tokenPair.length, 32)) // Padding
    ]);
    
    return new TransactionInstruction({
      keys: [
        { pubkey: priceAccount, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false },
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId: this.config.oracleProgram,
      data: initData
    });
  }
  
  /**
   * Create price update instruction
   */
  createUpdatePriceInstruction(tokenPair, price, priceAccount, authority) {
    if (!this.config.oracleProgram) {
      throw new Error('Oracle program not initialized');
    }
    
    // Convert price to scaled integer (6 decimal places)
    const scaledPrice = new Decimal(price).mul(1000000).floor();
    const priceBuffer = Buffer.alloc(8);
    priceBuffer.writeBigUInt64LE(BigInt(scaledPrice.toString()));
    
    const updateData = Buffer.concat([
      Buffer.from([1]), // Update instruction
      Buffer.from(tokenPair, 'utf8').subarray(0, 32), // Token pair
      Buffer.alloc(32 - Math.min(tokenPair.length, 32)), // Padding
      priceBuffer, // Price (8 bytes)
      Buffer.alloc(8) // Timestamp (8 bytes)
    ]);
    
    // Write timestamp
    updateData.writeBigUInt64LE(BigInt(Date.now()), updateData.length - 8);
    
    return new TransactionInstruction({
      keys: [
        { pubkey: priceAccount, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false }
      ],
      programId: this.config.oracleProgram,
      data: updateData
    });
  }
  
  /**
   * Initialize price account on-chain
   */
  async initializePriceAccount(tokenPair, authority, payer = null) {
    try {
      const payerKeypair = payer || authority;
      
      // Get price account info
      const priceAccountInfo = await this.getPriceAccount(tokenPair, authority);
      
      // Check if account already exists
      const exists = await this.checkPriceAccount(priceAccountInfo.address);
      if (exists) {
        this.log(`Price account for ${tokenPair} already exists`);
        return priceAccountInfo;
      }
      
      // Create initialization transaction
      const transaction = new Transaction();
      
      const initInstruction = this.createInitializePriceAccountInstruction(
        tokenPair,
        priceAccountInfo.address,
        authority.publicKey,
        payerKeypair.publicKey
      );
      
      transaction.add(initInstruction);
      
      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = payerKeypair.publicKey;
      
      // Sign transaction
      const signers = [payerKeypair];
      if (authority !== payerKeypair) {
        signers.push(authority);
      }
      
      transaction.sign(...signers);
      
      // Send transaction
      const signature = await this.connection.sendRawTransaction(transaction.serialize());
      await this.connection.confirmTransaction(signature, this.config.commitment);
      
      this.log(`Price account initialized for ${tokenPair}: ${signature}`);
      
      return {
        ...priceAccountInfo,
        signature,
        initialized: true
      };
      
    } catch (error) {
      this.log(`Failed to initialize price account for ${tokenPair}: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * Update price on-chain
   */
  async updatePrice(tokenPair, price, authority) {
    try {
      // Get price account
      const priceAccountInfo = await this.getPriceAccount(tokenPair, authority);
      
      // Check if account exists, initialize if needed
      const exists = await this.checkPriceAccount(priceAccountInfo.address);
      if (!exists) {
        this.log(`Price account doesn't exist, initializing for ${tokenPair}`);
        await this.initializePriceAccount(tokenPair, authority);
      }
      
      // Create update transaction
      const transaction = new Transaction();
      
      const updateInstruction = this.createUpdatePriceInstruction(
        tokenPair,
        price,
        priceAccountInfo.address,
        authority
      );
      
      transaction.add(updateInstruction);
      
      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = authority.publicKey;
      
      // Sign and send transaction
      transaction.sign(authority);
      
      const signature = await this.connection.sendRawTransaction(transaction.serialize());
      await this.connection.confirmTransaction(signature, this.config.commitment);
      
      // Update cache
      this.priceCache.set(tokenPair, {
        price: new Decimal(price),
        timestamp: Date.now(),
        signature
      });
      
      this.log(`Price updated for ${tokenPair}: $${price} (${signature})`);
      
      return {
        tokenPair,
        price,
        signature,
        timestamp: Date.now(),
        priceAccount: priceAccountInfo.address.toString()
      };
      
    } catch (error) {
      this.log(`Failed to update price for ${tokenPair}: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * Read price from on-chain account
   */
  async readPrice(tokenPair, authority) {
    try {
      const priceAccountInfo = await this.getPriceAccount(tokenPair, authority);
      
      const accountInfo = await this.connection.getAccountInfo(priceAccountInfo.address);
      
      if (!accountInfo || !accountInfo.data) {
        throw new Error(`Price account not found for ${tokenPair}`);
      }
      
      // Parse price data (simplified format)
      const data = accountInfo.data;
      
      if (data.length < 48) { // Minimum expected size
        throw new Error('Invalid price account data');
      }
      
      // Read token pair (32 bytes)
      const storedTokenPair = data.subarray(0, 32).toString('utf8').replace(/\0/g, '');
      
      // Read price (8 bytes at offset 32)
      const scaledPrice = data.readBigUInt64LE(32);
      const price = new Decimal(scaledPrice.toString()).div(1000000);
      
      // Read timestamp (8 bytes at offset 40)
      const timestamp = Number(data.readBigUInt64LE(40));
      
      const priceData = {
        tokenPair: storedTokenPair,
        price: price.toNumber(),
        timestamp,
        age: Date.now() - timestamp,
        priceAccount: priceAccountInfo.address.toString()
      };
      
      // Update cache
      this.priceCache.set(tokenPair, {
        price,
        timestamp,
        fromChain: true
      });
      
      this.log(`Price read for ${tokenPair}: $${price.toFixed(4)} (age: ${Math.floor(priceData.age / 1000)}s)`);
      
      return priceData;
      
    } catch (error) {
      this.log(`Failed to read price for ${tokenPair}: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * Get cached price
   */
  getCachedPrice(tokenPair) {
    const cached = this.priceCache.get(tokenPair);
    
    if (!cached) {
      return null;
    }
    
    return {
      tokenPair,
      price: cached.price.toNumber(),
      timestamp: cached.timestamp,
      age: Date.now() - cached.timestamp,
      fromCache: true,
      fromChain: cached.fromChain || false
    };
  }
  
  /**
   * Get all cached prices
   */
  getAllCachedPrices() {
    const prices = {};
    
    for (const [tokenPair, cached] of this.priceCache) {
      prices[tokenPair] = {
        price: cached.price.toNumber(),
        timestamp: cached.timestamp,
        age: Date.now() - cached.timestamp
      };
    }
    
    return prices;
  }
  
  /**
   * Batch update multiple prices
   */
  async batchUpdatePrices(priceUpdates, authority) {
    const results = [];
    const errors = [];
    
    this.log(`Starting batch update of ${priceUpdates.length} prices`);
    
    for (const { tokenPair, price } of priceUpdates) {
      try {
        const result = await this.updatePrice(tokenPair, price, authority);
        results.push(result);
        
        // Add delay between updates to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        errors.push({ tokenPair, price, error: error.message });
        this.log(`Batch update failed for ${tokenPair}: ${error.message}`, 'error');
      }
    }
    
    this.log(`Batch update completed: ${results.length} successful, ${errors.length} failed`);
    
    return {
      successful: results,
      failed: errors,
      totalUpdates: priceUpdates.length,
      successRate: results.length / priceUpdates.length
    };
  }
  
  /**
   * Monitor price account for changes
   */
  async monitorPriceAccount(tokenPair, authority, callback) {
    try {
      const priceAccountInfo = await this.getPriceAccount(tokenPair, authority);
      
      this.log(`Starting price monitoring for ${tokenPair}`);
      
      const subscriptionId = this.connection.onAccountChange(
        priceAccountInfo.address,
        (accountInfo) => {
          try {
            if (accountInfo.data && accountInfo.data.length >= 48) {
              // Parse price data
              const data = accountInfo.data;
              const scaledPrice = data.readBigUInt64LE(32);
              const price = new Decimal(scaledPrice.toString()).div(1000000);
              const timestamp = Number(data.readBigUInt64LE(40));
              
              const priceData = {
                tokenPair,
                price: price.toNumber(),
                timestamp,
                priceAccount: priceAccountInfo.address.toString()
              };
              
              // Update cache
              this.priceCache.set(tokenPair, {
                price,
                timestamp,
                fromChain: true
              });
              
              // Call callback
              if (callback) {
                callback(priceData);
              }
              
              this.log(`Price change detected for ${tokenPair}: $${price.toFixed(4)}`);
            }
          } catch (error) {
            this.log(`Error parsing price change for ${tokenPair}: ${error.message}`, 'error');
          }
        },
        this.config.commitment
      );
      
      return {
        subscriptionId,
        stop: () => {
          this.connection.removeAccountChangeListener(subscriptionId);
          this.log(`Price monitoring stopped for ${tokenPair}`);
        }
      };
      
    } catch (error) {
      this.log(`Failed to start price monitoring for ${tokenPair}: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * Get oracle statistics
   */
  getStats() {
    return {
      oracleProgram: this.config.oracleProgram?.toString(),
      priceAccounts: this.priceAccounts.size,
      cachedPrices: this.priceCache.size,
      tokenPairs: Array.from(this.priceAccounts.keys()),
      lastUpdates: this.getAllCachedPrices()
    };
  }
  
  /**
   * Log message with timestamp
   */
  log(message, level = 'info') {
    if (!this.config.enableLogging) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [ORACLE]`;
    
    switch (level) {
      case 'error':
        console.error(`${prefix} ❌ ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ⚠️  ${message}`);
        break;
      case 'success':
        console.log(`${prefix} ✅ ${message}`);
        break;
      default:
        console.log(`${prefix} ℹ️  ${message}`);
    }
  }
}
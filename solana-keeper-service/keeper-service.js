import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  ComputeBudgetProgram
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import axios from 'axios';
import Decimal from 'decimal.js';
import bs58 from 'bs58';
import { PriceUpdateInstructionFactory } from './update-price-instruction.js';

/**
 * Solana Keeper Service
 * 
 * Periodically fetches prices and updates them on Solana blockchain
 * Uses a funded wallet to sign and send transactions
 */
export default class KeeperService {
  constructor(config = {}) {
    this.config = {
      // Solana connection settings
      rpcEndpoint: config.rpcEndpoint || 'https://api.devnet.solana.com',
      commitment: config.commitment || 'confirmed',
      
      // Keeper settings
      updateInterval: config.updateInterval || 60000, // 1 minute
      priceThreshold: config.priceThreshold || 0.01, // 1% price change threshold
      maxRetries: config.maxRetries || 3,
      
      // Transaction settings
      priorityFee: config.priorityFee || 1000, // microlamports
      computeUnits: config.computeUnits || 200000,
      
      // Price sources
      enableOKX: config.enableOKX !== false,
      enableBinance: config.enableBinance !== false,
      enableCoinGecko: config.enableCoinGecko !== false,
      
      // Logging
      enableLogging: config.enableLogging !== false,
      
      // Safety settings
      maxTransactionFee: config.maxTransactionFee || 0.01 * LAMPORTS_PER_SOL, // 0.01 SOL
      minWalletBalance: config.minWalletBalance || 0.1 * LAMPORTS_PER_SOL, // 0.1 SOL
      
      // Price oracle settings
      oracleProgram: config.oracleProgram || null, // Custom oracle program ID
      priceAccounts: config.priceAccounts || new Map(), // Token -> Price Account mapping
      
      ...config
    };
    
    // Initialize connection
    this.connection = new Connection(this.config.rpcEndpoint, this.config.commitment);
    
    // Wallet and accounts
    this.wallet = null;
    this.walletBalance = 0;
    
    // Price tracking
    this.lastPrices = new Map();
    this.priceHistory = new Map();
    this.updateCount = 0;
    this.errorCount = 0;
    
    // Service state
    this.isRunning = false;
    this.updateInterval = null;
    
    // Statistics
    this.stats = {
      totalUpdates: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      totalTransactions: 0,
      totalFees: 0,
      startTime: null,
      lastUpdate: null,
      averageUpdateTime: 0,
      priceUpdates: new Map()
    };
    
    // Initialize price update instruction factory
    this.instructionFactory = new PriceUpdateInstructionFactory(
      this.config.oracleProgram || '11111111111111111111111111111112'
    );
    
    this.log('Keeper Service initialized');
  }
  
  /**
   * Initialize the keeper service with a wallet
   */
  async initialize(privateKey) {
    try {
      // Load wallet from private key
      if (typeof privateKey === 'string') {
        // Handle base58 encoded private key
        const secretKey = bs58.decode(privateKey);
        this.wallet = Keypair.fromSecretKey(secretKey);
      } else if (privateKey instanceof Uint8Array) {
        this.wallet = Keypair.fromSecretKey(privateKey);
      } else if (privateKey instanceof Keypair) {
        this.wallet = privateKey;
      } else {
        throw new Error('Invalid private key format');
      }
      
      this.log(`Wallet loaded: ${this.wallet.publicKey.toString()}`);
      
      // Check wallet balance
      await this.checkWalletBalance();
      
      // Initialize price accounts if oracle program is specified
      if (this.config.oracleProgram) {
        await this.initializePriceAccounts();
      }
      
      this.log('Keeper Service initialized successfully');
      return true;
      
    } catch (error) {
      this.log(`Initialization failed: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * Generate a new funded wallet for testing
   */
  static async generateFundedWallet(connection, fundingAmount = 1.0) {
    const wallet = Keypair.generate();
    
    try {
      // Request airdrop for devnet/testnet
      const signature = await connection.requestAirdrop(
        wallet.publicKey,
        fundingAmount * LAMPORTS_PER_SOL
      );
      
      // Wait for confirmation
      await connection.confirmTransaction(signature);
      
      const balance = await connection.getBalance(wallet.publicKey);
      
      return {
        wallet,
        publicKey: wallet.publicKey.toString(),
        privateKey: bs58.encode(wallet.secretKey),
        balance: balance / LAMPORTS_PER_SOL
      };
      
    } catch (error) {
      throw new Error(`Failed to generate funded wallet: ${error.message}`);
    }
  }
  
  /**
   * Check wallet balance and ensure sufficient funds
   */
  async checkWalletBalance() {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    
    try {
      this.walletBalance = await this.connection.getBalance(this.wallet.publicKey);
      
      this.log(`Wallet balance: ${(this.walletBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
      
      if (this.walletBalance < this.config.minWalletBalance) {
        this.log(`Warning: Wallet balance below minimum threshold (${this.config.minWalletBalance / LAMPORTS_PER_SOL} SOL)`, 'warn');
      }
      
      return this.walletBalance;
      
    } catch (error) {
      this.log(`Failed to check wallet balance: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * Initialize price accounts for oracle updates
   */
  async initializePriceAccounts() {
    if (!this.config.oracleProgram) {
      return;
    }
    
    this.log('Initializing price accounts...');
    
    // For demo purposes, we'll create mock price accounts
    // In a real implementation, these would be actual oracle program accounts
    const tokens = ['SOL/USDC', 'BTC/USDT', 'ETH/USDT'];
    
    for (const token of tokens) {
      if (!this.config.priceAccounts.has(token)) {
        // Generate a deterministic price account address
        const [priceAccount] = await PublicKey.findProgramAddress(
          [Buffer.from('price'), Buffer.from(token)],
          new PublicKey(this.config.oracleProgram)
        );
        
        this.config.priceAccounts.set(token, priceAccount);
        this.log(`Price account for ${token}: ${priceAccount.toString()}`);
      }
    }
  }
  
  /**
   * Fetch current prices from multiple sources
   */
  async fetchPrices() {
    const prices = new Map();
    const sources = [];
    
    try {
      // Fetch from OKX
      if (this.config.enableOKX) {
        try {
          const okxPrices = await this.fetchOKXPrices();
          okxPrices.forEach((price, token) => {
            if (!prices.has(token)) prices.set(token, []);
            prices.get(token).push({ source: 'okx', price, timestamp: Date.now() });
          });
          sources.push('okx');
        } catch (error) {
          this.log(`OKX price fetch failed: ${error.message}`, 'warn');
        }
      }
      
      // Fetch from Binance
      if (this.config.enableBinance) {
        try {
          const binancePrices = await this.fetchBinancePrices();
          binancePrices.forEach((price, token) => {
            if (!prices.has(token)) prices.set(token, []);
            prices.get(token).push({ source: 'binance', price, timestamp: Date.now() });
          });
          sources.push('binance');
        } catch (error) {
          this.log(`Binance price fetch failed: ${error.message}`, 'warn');
        }
      }
      
      // Fetch from CoinGecko
      if (this.config.enableCoinGecko) {
        try {
          const coinGeckoPrices = await this.fetchCoinGeckoPrices();
          coinGeckoPrices.forEach((price, token) => {
            if (!prices.has(token)) prices.set(token, []);
            prices.get(token).push({ source: 'coingecko', price, timestamp: Date.now() });
          });
          sources.push('coingecko');
        } catch (error) {
          this.log(`CoinGecko price fetch failed: ${error.message}`, 'warn');
        }
      }
      
      // Calculate aggregated prices
      const aggregatedPrices = new Map();
      
      for (const [token, priceData] of prices) {
        if (priceData.length > 0) {
          // Simple average for now (could use VWAP/TWAP from price aggregation service)
          const avgPrice = priceData.reduce((sum, data) => {
            const price = typeof data.price === 'number' ? data.price : parseFloat(data.price);
            return sum + (isNaN(price) ? 0 : price);
          }, 0) / priceData.length;
          
          if (!isNaN(avgPrice) && avgPrice > 0) {
            aggregatedPrices.set(token, {
              price: new Decimal(avgPrice),
              sources: priceData.map(d => d.source),
              dataPoints: priceData.length,
              timestamp: Date.now()
            });
          }
        }
      }
      
      this.log(`Fetched prices from ${sources.length} sources: ${sources.join(', ')}`);
      return aggregatedPrices;
      
    } catch (error) {
      this.log(`Price fetch failed: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * Fetch prices from OKX
   */
  async fetchOKXPrices() {
    const prices = new Map();
    
    try {
      const response = await axios.get('https://www.okx.com/api/v5/market/tickers', {
        params: { instType: 'SPOT' },
        timeout: 10000
      });
      
      if (response.data && response.data.data) {
        const tickers = response.data.data;
        
        // Map common trading pairs
        const pairMapping = {
          'SOL-USDC': 'SOL/USDC',
          'SOL-USDT': 'SOL/USDC',
          'BTC-USDT': 'BTC/USDT',
          'ETH-USDT': 'ETH/USDT'
        };
        
        for (const ticker of tickers) {
          const mappedPair = pairMapping[ticker.instId];
          if (mappedPair && ticker.last) {
            prices.set(mappedPair, parseFloat(ticker.last));
          }
        }
      }
      
    } catch (error) {
      throw new Error(`OKX API error: ${error.message}`);
    }
    
    return prices;
  }
  
  /**
   * Fetch prices from Binance
   */
  async fetchBinancePrices() {
    const prices = new Map();
    
    try {
      const response = await axios.get('https://api.binance.com/api/v3/ticker/price', {
        timeout: 10000
      });
      
      if (response.data) {
        const tickers = Array.isArray(response.data) ? response.data : [response.data];
        
        // Map common trading pairs
        const pairMapping = {
          'SOLUSDC': 'SOL/USDC',
          'SOLUSDT': 'SOL/USDC',
          'BTCUSDT': 'BTC/USDT',
          'ETHUSDT': 'ETH/USDT'
        };
        
        for (const ticker of tickers) {
          const mappedPair = pairMapping[ticker.symbol];
          if (mappedPair && ticker.price) {
            prices.set(mappedPair, parseFloat(ticker.price));
          }
        }
      }
      
    } catch (error) {
      throw new Error(`Binance API error: ${error.message}`);
    }
    
    return prices;
  }
  
  /**
   * Fetch prices from CoinGecko
   */
  async fetchCoinGeckoPrices() {
    const prices = new Map();
    
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: {
          ids: 'solana,bitcoin,ethereum',
          vs_currencies: 'usd'
        },
        timeout: 10000
      });
      
      if (response.data) {
        if (response.data.solana?.usd) {
          prices.set('SOL/USDC', response.data.solana.usd);
        }
        if (response.data.bitcoin?.usd) {
          prices.set('BTC/USDT', response.data.bitcoin.usd);
        }
        if (response.data.ethereum?.usd) {
          prices.set('ETH/USDT', response.data.ethereum.usd);
        }
      }
      
    } catch (error) {
      throw new Error(`CoinGecko API error: ${error.message}`);
    }
    
    return prices;
  }
  
  /**
   * Check if price update is needed
   */
  shouldUpdatePrice(token, newPriceData) {
    const lastPrice = this.lastPrices.get(token);
    
    if (!lastPrice) {
      return true; // First time, always update
    }
    
    // Extract the price value from the price data object
    let newPrice = newPriceData;
    if (typeof newPriceData === 'object' && newPriceData !== null) {
      newPrice = newPriceData.price || newPriceData.value || newPriceData;
    }
    
    let lastPriceValue = lastPrice;
    if (typeof lastPrice === 'object' && lastPrice !== null) {
      lastPriceValue = lastPrice.price || lastPrice.value || lastPrice;
    }
    
    // Convert to numbers first, then to Decimal
    const newPriceNum = typeof newPrice === 'number' ? newPrice : parseFloat(newPrice);
    const lastPriceNum = typeof lastPriceValue === 'number' ? lastPriceValue : parseFloat(lastPriceValue);
    
    if (isNaN(newPriceNum) || isNaN(lastPriceNum)) {
      this.log(`Invalid price data for ${token}: new=${newPrice}, last=${lastPriceValue}`, 'warn');
      return false;
    }
    
    // Ensure both are Decimal objects
    const newPriceDecimal = new Decimal(newPriceNum);
    const lastPriceDecimal = new Decimal(lastPriceNum);
    
    const priceChange = Math.abs(newPriceDecimal.minus(lastPriceDecimal).dividedBy(lastPriceDecimal).toNumber());
    
    return priceChange >= this.config.priceThreshold;
  }

  /**
   * Get price sources from last aggregation for Task 7 integration
   */
  getLastPriceSources(token) {
    const priceHistory = this.priceHistory.get(token);
    if (!priceHistory || priceHistory.length === 0) {
      return [{ name: 'keeper', price: this.lastPrices.get(token)?.toString() || '0' }];
    }
    
    const lastEntry = priceHistory[priceHistory.length - 1];
    return lastEntry.sources || [{ name: 'keeper', price: lastEntry.price?.toString() || '0' }];
  }
  
  /**
   * Create price update transaction
   */
  async createPriceUpdateTransaction(token, price) {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    
    const transaction = new Transaction();
    
    // Add compute budget instructions
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: this.config.computeUnits
      })
    );
    
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: this.config.priorityFee
      })
    );
    
    if (this.config.oracleProgram && this.config.priceAccounts.has(token)) {
      // Create oracle update instruction using Task 7 implementation
      const priceFeedAccount = this.config.priceAccounts.get(token);
      
      try {
        // Get price sources from last aggregation
        const sources = this.getLastPriceSources(token);
        
        // Create update price instruction using the factory
        const updateInstruction = this.instructionFactory.createKeeperInstruction({
          symbol: token,
          price: price,
          sources: sources,
          keeperWallet: this.wallet.publicKey
        });
        
        transaction.add(updateInstruction);
        
        this.log(`Created update price instruction for ${token}: $${price.toString()}`);
        
      } catch (error) {
        this.log(`Failed to create update instruction for ${token}: ${error.message}`, 'error');
        
        // Fallback to memo instruction
        const memoData = JSON.stringify({
          action: 'price_update_fallback',
          token,
          price: price.toString(),
          timestamp: Date.now(),
          keeper: this.wallet.publicKey.toString(),
          error: error.message
        });
        
        const memoInstruction = new TransactionInstruction({
          keys: [{ pubkey: this.wallet.publicKey, isSigner: true, isWritable: false }],
          programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
          data: Buffer.from(memoData, 'utf8')
        });
        
        transaction.add(memoInstruction);
      }
      
    } else {
      // Create a memo transaction for demonstration
      const memoData = JSON.stringify({
        action: 'price_update',
        token,
        price: price.toString(),
        timestamp: Date.now(),
        keeper: this.wallet.publicKey.toString()
      });
      
      const memoInstruction = new TransactionInstruction({
        keys: [{ pubkey: this.wallet.publicKey, isSigner: true, isWritable: false }],
        programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'), // Memo program
        data: Buffer.from(memoData, 'utf8')
      });
      
      transaction.add(memoInstruction);
    }
    
    return transaction;
  }
  
  /**
   * Send price update transaction
   */
  async sendPriceUpdate(token, price) {
    const startTime = Date.now();
    
    try {
      // Check wallet balance
      await this.checkWalletBalance();
      
      if (this.walletBalance < this.config.minWalletBalance) {
        throw new Error('Insufficient wallet balance for transaction');
      }
      
      // Create transaction
      const transaction = await this.createPriceUpdateTransaction(token, price);
      
      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.wallet.publicKey;
      
      // Estimate transaction fee
      const fee = await transaction.getEstimatedFee(this.connection);
      
      if (fee > this.config.maxTransactionFee) {
        throw new Error(`Transaction fee too high: ${fee / LAMPORTS_PER_SOL} SOL`);
      }
      
      // Sign and send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.wallet],
        {
          commitment: this.config.commitment,
          maxRetries: this.config.maxRetries
        }
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Update statistics
      this.stats.totalTransactions++;
      this.stats.totalFees += fee;
      this.stats.successfulUpdates++;
      this.stats.averageUpdateTime = (this.stats.averageUpdateTime * (this.stats.totalTransactions - 1) + duration) / this.stats.totalTransactions;
      
      // Update price tracking
      this.lastPrices.set(token, { price, timestamp: Date.now() });
      
      if (!this.stats.priceUpdates.has(token)) {
        this.stats.priceUpdates.set(token, 0);
      }
      this.stats.priceUpdates.set(token, this.stats.priceUpdates.get(token) + 1);
      
      this.log(`Price update sent for ${token}: $${price.toFixed(4)} (${signature})`);
      this.log(`Transaction fee: ${(fee / LAMPORTS_PER_SOL).toFixed(6)} SOL, Duration: ${duration}ms`);
      
      return {
        signature,
        token,
        price: price.toNumber(),
        fee,
        duration,
        timestamp: Date.now()
      };
      
    } catch (error) {
      this.stats.failedUpdates++;
      this.errorCount++;
      
      this.log(`Price update failed for ${token}: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * Process price updates for all tokens
   */
  async processPriceUpdates() {
    const updateStartTime = Date.now();
    
    try {
      this.log('Starting price update cycle...');
      
      // Fetch current prices
      const currentPrices = await this.fetchPrices();
      
      if (currentPrices.size === 0) {
        this.log('No prices fetched, skipping update cycle', 'warn');
        return;
      }
      
      const updates = [];
      
      // Check each token for update requirements
      for (const [token, priceData] of currentPrices) {
        try {
          if (this.shouldUpdatePrice(token, priceData.price)) {
            this.log(`Price change detected for ${token}: $${priceData.price.toFixed(4)}`);
            
            const updateResult = await this.sendPriceUpdate(token, priceData.price);
            updates.push(updateResult);
            
            // Add delay between transactions to avoid rate limits
            if (updates.length < currentPrices.size) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } else {
            this.log(`No significant price change for ${token}: $${priceData.price.toFixed(4)}`);
          }
        } catch (error) {
          this.log(`Failed to update ${token}: ${error.message}`, 'error');
        }
      }
      
      const updateEndTime = Date.now();
      const cycleDuration = updateEndTime - updateStartTime;
      
      this.stats.totalUpdates++;
      this.stats.lastUpdate = Date.now();
      this.updateCount++;
      
      this.log(`Update cycle completed: ${updates.length} updates sent in ${cycleDuration}ms`);
      
      return {
        updates,
        duration: cycleDuration,
        pricesChecked: currentPrices.size,
        updatesExecuted: updates.length
      };
      
    } catch (error) {
      this.log(`Update cycle failed: ${error.message}`, 'error');
      this.errorCount++;
      throw error;
    }
  }
  
  /**
   * Start the keeper service
   */
  async start() {
    if (this.isRunning) {
      this.log('Keeper service is already running', 'warn');
      return;
    }
    
    if (!this.wallet) {
      throw new Error('Wallet not initialized. Call initialize() first.');
    }
    
    this.isRunning = true;
    this.stats.startTime = Date.now();
    
    this.log(`Starting keeper service with ${this.config.updateInterval}ms interval`);
    
    // Initial update
    try {
      await this.processPriceUpdates();
    } catch (error) {
      this.log(`Initial update failed: ${error.message}`, 'error');
    }
    
    // Set up periodic updates
    this.updateInterval = setInterval(async () => {
      if (this.isRunning) {
        try {
          await this.processPriceUpdates();
        } catch (error) {
          this.log(`Periodic update failed: ${error.message}`, 'error');
        }
      }
    }, this.config.updateInterval);
    
    this.log('Keeper service started successfully');
  }
  
  /**
   * Stop the keeper service
   */
  stop() {
    if (!this.isRunning) {
      this.log('Keeper service is not running', 'warn');
      return;
    }
    
    this.isRunning = false;
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    this.log('Keeper service stopped');
  }
  
  /**
   * Get service statistics
   */
  getStats() {
    const runtime = this.stats.startTime ? Date.now() - this.stats.startTime : 0;
    
    return {
      ...this.stats,
      runtime,
      isRunning: this.isRunning,
      updateCount: this.updateCount,
      errorCount: this.errorCount,
      walletBalance: this.walletBalance / LAMPORTS_PER_SOL,
      walletAddress: this.wallet?.publicKey.toString(),
      lastPrices: Object.fromEntries(
        Array.from(this.lastPrices.entries()).map(([token, data]) => [
          token,
          { price: data.price.toNumber(), timestamp: data.timestamp }
        ])
      ),
      priceUpdateCounts: Object.fromEntries(this.stats.priceUpdates),
      averageFeePerTransaction: this.stats.totalTransactions > 0 
        ? this.stats.totalFees / this.stats.totalTransactions / LAMPORTS_PER_SOL 
        : 0
    };
  }
  
  /**
   * Get price history for a token
   */
  getPriceHistory(token) {
    return this.priceHistory.get(token) || [];
  }
  
  /**
   * Log message with timestamp
   */
  log(message, level = 'info') {
    if (!this.config.enableLogging) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [KEEPER]`;
    
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
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import fs from 'fs';
import path from 'path';

/**
 * Wallet Manager for Keeper Service
 * 
 * Handles wallet creation, funding, and management for the keeper service
 */
export default class WalletManager {
  constructor(config = {}) {
    this.config = {
      rpcEndpoint: config.rpcEndpoint || 'https://api.devnet.solana.com',
      commitment: config.commitment || 'confirmed',
      walletPath: config.walletPath || './keeper-wallet.json',
      enableLogging: config.enableLogging !== false,
      ...config
    };
    
    this.connection = new Connection(this.config.rpcEndpoint, this.config.commitment);
  }
  
  /**
   * Generate a new wallet
   */
  generateWallet() {
    const wallet = Keypair.generate();
    
    const walletInfo = {
      publicKey: wallet.publicKey.toString(),
      privateKey: bs58.encode(wallet.secretKey),
      secretKey: Array.from(wallet.secretKey),
      created: new Date().toISOString()
    };
    
    this.log(`Generated new wallet: ${walletInfo.publicKey}`);
    
    return {
      wallet,
      ...walletInfo
    };
  }
  
  /**
   * Save wallet to file
   */
  saveWallet(walletInfo, filePath = null) {
    const savePath = filePath || this.config.walletPath;
    
    try {
      // Ensure directory exists
      const dir = path.dirname(savePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Save wallet data
      const walletData = {
        publicKey: walletInfo.publicKey,
        privateKey: walletInfo.privateKey,
        secretKey: walletInfo.secretKey,
        created: walletInfo.created || new Date().toISOString(),
        network: this.config.rpcEndpoint.includes('devnet') ? 'devnet' : 
                this.config.rpcEndpoint.includes('testnet') ? 'testnet' : 'mainnet'
      };
      
      fs.writeFileSync(savePath, JSON.stringify(walletData, null, 2));
      
      this.log(`Wallet saved to: ${savePath}`);
      return savePath;
      
    } catch (error) {
      this.log(`Failed to save wallet: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * Load wallet from file
   */
  loadWallet(filePath = null) {
    const loadPath = filePath || this.config.walletPath;
    
    try {
      if (!fs.existsSync(loadPath)) {
        throw new Error(`Wallet file not found: ${loadPath}`);
      }
      
      const walletData = JSON.parse(fs.readFileSync(loadPath, 'utf8'));
      
      // Validate wallet data
      if (!walletData.secretKey || !Array.isArray(walletData.secretKey)) {
        throw new Error('Invalid wallet file format');
      }
      
      const wallet = Keypair.fromSecretKey(new Uint8Array(walletData.secretKey));
      
      // Verify public key matches
      if (wallet.publicKey.toString() !== walletData.publicKey) {
        throw new Error('Wallet public key mismatch');
      }
      
      this.log(`Wallet loaded from: ${loadPath}`);
      this.log(`Public key: ${wallet.publicKey.toString()}`);
      
      return {
        wallet,
        publicKey: walletData.publicKey,
        privateKey: walletData.privateKey,
        created: walletData.created,
        network: walletData.network
      };
      
    } catch (error) {
      this.log(`Failed to load wallet: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * Create wallet from private key string
   */
  createWalletFromPrivateKey(privateKey) {
    try {
      let secretKey;
      
      if (typeof privateKey === 'string') {
        // Try base58 decode first
        try {
          secretKey = bs58.decode(privateKey);
        } catch {
          // Try JSON array format
          try {
            secretKey = new Uint8Array(JSON.parse(privateKey));
          } catch {
            throw new Error('Invalid private key format');
          }
        }
      } else if (Array.isArray(privateKey)) {
        secretKey = new Uint8Array(privateKey);
      } else {
        throw new Error('Private key must be string or array');
      }
      
      const wallet = Keypair.fromSecretKey(secretKey);
      
      return {
        wallet,
        publicKey: wallet.publicKey.toString(),
        privateKey: bs58.encode(wallet.secretKey),
        secretKey: Array.from(wallet.secretKey)
      };
      
    } catch (error) {
      this.log(`Failed to create wallet from private key: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * Request airdrop for wallet (devnet/testnet only)
   */
  async requestAirdrop(wallet, amount = 1.0) {
    try {
      const publicKey = wallet instanceof Keypair ? wallet.publicKey : new PublicKey(wallet);
      
      this.log(`Requesting airdrop of ${amount} SOL for ${publicKey.toString()}`);
      
      const signature = await this.connection.requestAirdrop(
        publicKey,
        amount * LAMPORTS_PER_SOL
      );
      
      // Wait for confirmation
      await this.connection.confirmTransaction(signature, this.config.commitment);
      
      const balance = await this.connection.getBalance(publicKey);
      
      this.log(`Airdrop successful! New balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
      
      return {
        signature,
        amount,
        newBalance: balance / LAMPORTS_PER_SOL
      };
      
    } catch (error) {
      this.log(`Airdrop failed: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * Check wallet balance
   */
  async getBalance(wallet) {
    try {
      const publicKey = wallet instanceof Keypair ? wallet.publicKey : new PublicKey(wallet);
      const balance = await this.connection.getBalance(publicKey);
      
      return {
        lamports: balance,
        sol: balance / LAMPORTS_PER_SOL
      };
      
    } catch (error) {
      this.log(`Failed to get balance: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * Get wallet info including balance and transaction history
   */
  async getWalletInfo(wallet) {
    try {
      const publicKey = wallet instanceof Keypair ? wallet.publicKey : new PublicKey(wallet);
      
      // Get balance
      const balance = await this.getBalance(publicKey);
      
      // Get recent transactions
      const signatures = await this.connection.getSignaturesForAddress(publicKey, { limit: 10 });
      
      // Get account info
      const accountInfo = await this.connection.getAccountInfo(publicKey);
      
      return {
        publicKey: publicKey.toString(),
        balance,
        recentTransactions: signatures.length,
        accountExists: accountInfo !== null,
        executable: accountInfo?.executable || false,
        owner: accountInfo?.owner?.toString() || 'System Program',
        rentEpoch: accountInfo?.rentEpoch
      };
      
    } catch (error) {
      this.log(`Failed to get wallet info: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * Create and fund a new keeper wallet
   */
  async createKeeperWallet(fundingAmount = 1.0, savePath = null) {
    try {
      this.log('Creating new keeper wallet...');
      
      // Generate wallet
      const walletInfo = this.generateWallet();
      
      // Request airdrop (for devnet/testnet)
      if (this.config.rpcEndpoint.includes('devnet') || this.config.rpcEndpoint.includes('testnet')) {
        await this.requestAirdrop(walletInfo.wallet, fundingAmount);
      } else {
        this.log('Mainnet detected - manual funding required', 'warn');
      }
      
      // Save wallet
      const savedPath = this.saveWallet(walletInfo, savePath);
      
      // Get final wallet info
      const finalInfo = await this.getWalletInfo(walletInfo.wallet);
      
      this.log('Keeper wallet created successfully!', 'success');
      
      return {
        ...walletInfo,
        ...finalInfo,
        savedPath
      };
      
    } catch (error) {
      this.log(`Failed to create keeper wallet: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * Validate wallet for keeper service
   */
  async validateKeeperWallet(wallet, minBalance = 0.1) {
    try {
      const walletInfo = await this.getWalletInfo(wallet);
      
      const validations = {
        exists: walletInfo.accountExists,
        hasBalance: walletInfo.balance.sol >= minBalance,
        isExecutable: !walletInfo.executable, // Should not be executable
        isSystemOwned: walletInfo.owner === 'System Program'
      };
      
      const isValid = Object.values(validations).every(v => v);
      
      this.log(`Wallet validation: ${isValid ? 'PASSED' : 'FAILED'}`);
      
      if (!validations.exists) {
        this.log('❌ Wallet account does not exist', 'error');
      }
      if (!validations.hasBalance) {
        this.log(`❌ Insufficient balance: ${walletInfo.balance.sol} SOL (minimum: ${minBalance} SOL)`, 'error');
      }
      if (!validations.isExecutable) {
        this.log('❌ Wallet should not be executable', 'error');
      }
      if (!validations.isSystemOwned) {
        this.log(`❌ Wallet should be owned by System Program, found: ${walletInfo.owner}`, 'error');
      }
      
      return {
        isValid,
        validations,
        walletInfo
      };
      
    } catch (error) {
      this.log(`Wallet validation failed: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * Monitor wallet balance and alert if low
   */
  async monitorBalance(wallet, minBalance = 0.1, checkInterval = 60000) {
    const publicKey = wallet instanceof Keypair ? wallet.publicKey : new PublicKey(wallet);
    
    this.log(`Starting balance monitoring for ${publicKey.toString()}`);
    this.log(`Minimum balance: ${minBalance} SOL, Check interval: ${checkInterval}ms`);
    
    const checkBalance = async () => {
      try {
        const balance = await this.getBalance(publicKey);
        
        if (balance.sol < minBalance) {
          this.log(`⚠️ LOW BALANCE ALERT: ${balance.sol.toFixed(4)} SOL (minimum: ${minBalance} SOL)`, 'warn');
          
          // Could implement notifications here (email, webhook, etc.)
          return false;
        } else {
          this.log(`Balance check: ${balance.sol.toFixed(4)} SOL ✅`);
          return true;
        }
        
      } catch (error) {
        this.log(`Balance check failed: ${error.message}`, 'error');
        return false;
      }
    };
    
    // Initial check
    await checkBalance();
    
    // Set up periodic monitoring
    const monitorInterval = setInterval(checkBalance, checkInterval);
    
    return {
      stop: () => {
        clearInterval(monitorInterval);
        this.log('Balance monitoring stopped');
      }
    };
  }
  
  /**
   * Log message with timestamp
   */
  log(message, level = 'info') {
    if (!this.config.enableLogging) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [WALLET]`;
    
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
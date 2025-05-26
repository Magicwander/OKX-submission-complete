# Solana Keeper Service

A comprehensive, production-ready keeper service for periodically fetching and updating prices on Solana blockchain using funded wallets for transaction signing and submission.

## 🚀 Features

### Core Functionality
- **Multi-Source Price Aggregation**: Fetches prices from OKX, Binance, and CoinGecko APIs
- **Intelligent Price Change Detection**: Configurable thresholds to minimize unnecessary updates
- **Automated Transaction Signing**: Uses funded wallets to sign and submit transactions
- **Oracle Program Integration**: Ready for custom oracle program deployment
- **Real-time Monitoring**: Comprehensive statistics and performance tracking

### Advanced Features
- **Error Handling & Recovery**: Robust error handling with automatic retries
- **Performance Optimization**: Compute budget management and fee optimization
- **Wallet Management**: Secure wallet creation, funding, and validation
- **Service Lifecycle**: Start/stop functionality with graceful shutdown
- **Configurable Parameters**: Flexible configuration for different deployment scenarios

## 📦 Installation

```bash
# Clone the repository
git clone <repository-url>
cd solana-keeper-service

# Install dependencies
npm install

# Run tests
npm test

# Run demo
npm run demo
```

## 🔧 Dependencies

```json
{
  "@solana/web3.js": "^1.87.6",
  "@solana/spl-token": "^0.3.9",
  "axios": "^1.6.0",
  "decimal.js": "^10.4.3",
  "bs58": "^5.0.0",
  "tweetnacl": "^1.0.3"
}
```

## 🏗️ Architecture

### Components

1. **KeeperService**: Main service orchestrating price updates
2. **WalletManager**: Handles wallet creation, funding, and management
3. **PriceOracle**: Manages oracle program interactions and price caching
4. **PriceFeedAccount**: Comprehensive on-chain price data structure (Task 6)

### Data Flow

```
Price Sources (OKX, Binance, CoinGecko)
    ↓
Price Aggregation & Change Detection
    ↓
Transaction Creation & Signing
    ↓
Solana Blockchain Submission
    ↓
Oracle Program / Memo Updates
```

## 🚀 Quick Start

### Basic Usage

```javascript
import KeeperService from './keeper-service.js';
import WalletManager from './wallet-manager.js';

// Create wallet manager
const walletManager = new WalletManager({
  rpcEndpoint: 'https://api.devnet.solana.com'
});

// Create and fund wallet
const walletInfo = await walletManager.createKeeperWallet(2.0); // 2 SOL

// Initialize keeper service
const keeperService = new KeeperService({
  rpcEndpoint: 'https://api.devnet.solana.com',
  updateInterval: 60000, // 1 minute
  priceThreshold: 0.01,   // 1% change threshold
  enableOKX: true,
  enableCoinGecko: true
});

// Initialize with wallet
await keeperService.initialize(walletInfo.wallet);

// Start automated service
await keeperService.start();

// Service will now automatically:
// 1. Fetch prices every minute
// 2. Detect significant price changes
// 3. Create and submit transactions
// 4. Update on-chain price data
```

### Advanced Configuration

```javascript
const config = {
  // Network settings
  rpcEndpoint: 'https://api.mainnet-beta.solana.com',
  commitment: 'confirmed',
  
  // Update settings
  updateInterval: 30000,     // 30 seconds
  priceThreshold: 0.005,     // 0.5% change threshold
  maxRetries: 3,
  
  // Transaction settings
  priorityFee: 2000,         // microlamports
  computeUnits: 200000,
  maxTransactionFee: 0.01 * LAMPORTS_PER_SOL,
  
  // Price sources
  enableOKX: true,
  enableBinance: true,
  enableCoinGecko: true,
  
  // Safety settings
  minWalletBalance: 0.1 * LAMPORTS_PER_SOL,
  
  // Oracle settings
  oracleProgram: 'YourOracleProgramId...',
  priceAccounts: new Map([
    ['SOL/USDC', 'PriceAccountAddress...'],
    ['BTC/USDT', 'PriceAccountAddress...']
  ])
};

const keeperService = new KeeperService(config);
```

## 🔐 Wallet Management

### Creating a Funded Wallet

```javascript
import WalletManager from './wallet-manager.js';

const walletManager = new WalletManager({
  rpcEndpoint: 'https://api.devnet.solana.com'
});

// Create and fund wallet (devnet only)
const walletInfo = await walletManager.createKeeperWallet(2.0);

console.log('Wallet created:', walletInfo.publicKey);
console.log('Balance:', walletInfo.balance.sol, 'SOL');
```

### Loading Existing Wallet

```javascript
// Save wallet to file
walletManager.saveWallet(walletInfo, './my-keeper-wallet.json');

// Load wallet from file
const loadedWallet = walletManager.loadWallet('./my-keeper-wallet.json');

// Validate wallet for keeper service
const validation = await walletManager.validateKeeperWallet(
  loadedWallet.wallet, 
  0.1 // minimum balance in SOL
);

if (validation.isValid) {
  console.log('Wallet is ready for keeper service');
} else {
  console.log('Validation issues:', validation.validations);
}
```

### Wallet Monitoring

```javascript
// Monitor wallet balance
const monitor = await walletManager.monitorBalance(
  wallet, 
  0.1,    // minimum balance
  60000   // check interval (1 minute)
);

// Stop monitoring
monitor.stop();
```

## 🔮 Oracle Integration

### Basic Oracle Setup

```javascript
import PriceOracle from './price-oracle.js';

const priceOracle = new PriceOracle({
  rpcEndpoint: 'https://api.devnet.solana.com'
});

// Initialize with oracle program
priceOracle.initialize('YourOracleProgramId...');

// Get price account for token pair
const priceAccount = await priceOracle.getPriceAccount('SOL/USDC', authority);

// Update price on-chain
const result = await priceOracle.updatePrice('SOL/USDC', 177.50, authority);
console.log('Price updated:', result.signature);
```

### Price Caching

```javascript
// Cache price locally
priceOracle.priceCache.set('SOL/USDC', {
  price: new Decimal(177.50),
  timestamp: Date.now(),
  fromChain: false
});

// Retrieve cached price
const cached = priceOracle.getCachedPrice('SOL/USDC');
console.log('Cached price:', cached.price, 'Age:', cached.age, 'ms');

// Get all cached prices
const allPrices = priceOracle.getAllCachedPrices();
```

### Batch Price Updates

```javascript
const priceUpdates = [
  { tokenPair: 'SOL/USDC', price: 177.50 },
  { tokenPair: 'BTC/USDT', price: 45000.00 },
  { tokenPair: 'ETH/USDT', price: 2800.00 }
];

const results = await priceOracle.batchUpdatePrices(priceUpdates, authority);
console.log('Successful updates:', results.successful.length);
console.log('Failed updates:', results.failed.length);
```

## 📊 Monitoring & Statistics

### Service Statistics

```javascript
const stats = keeperService.getStats();

console.log('Runtime:', Math.floor(stats.runtime / 1000), 'seconds');
console.log('Total updates:', stats.totalUpdates);
console.log('Success rate:', (stats.successfulUpdates / stats.totalUpdates * 100).toFixed(1), '%');
console.log('Total transactions:', stats.totalTransactions);
console.log('Average fee:', stats.averageFeePerTransaction.toFixed(6), 'SOL');
console.log('Wallet balance:', stats.walletBalance.toFixed(4), 'SOL');

// Price update counts by token
for (const [token, count] of Object.entries(stats.priceUpdateCounts)) {
  console.log(`${token}: ${count} updates`);
}

// Last prices
for (const [token, data] of Object.entries(stats.lastPrices)) {
  console.log(`${token}: $${data.price.toFixed(4)} (${Date.now() - data.timestamp}ms ago)`);
}
```

### Oracle Statistics

```javascript
const oracleStats = priceOracle.getStats();

console.log('Oracle program:', oracleStats.oracleProgram);
console.log('Price accounts:', oracleStats.priceAccounts);
console.log('Cached prices:', oracleStats.cachedPrices);
console.log('Token pairs:', oracleStats.tokenPairs.join(', '));
```

## 🏗️ PriceFeedAccount Structure (Task 6)

### Overview

The PriceFeedAccount is a comprehensive on-chain data structure designed to store and manage price feed information with advanced features:

```javascript
import PriceFeedAccount from './price-feed-account.js';

const account = new PriceFeedAccount();
account.initialize(tokenPair, authority, oracleProgram);
account.updatePrice(priceData);
```

### Key Features

1. **Token Metadata**: Complete token pair information
2. **Price History**: Circular buffer with 1000 entries
3. **Statistics Tracking**: 24h, 7d, and all-time metrics
4. **Performance Monitoring**: Latency, throughput, and reliability
5. **Validation System**: Data integrity and staleness checks
6. **Serialization**: Borsh-compatible for on-chain storage

### Data Structure

```javascript
{
  // Account metadata
  isInitialized: true,
  authority: PublicKey,
  createdAt: timestamp,
  lastUpdated: timestamp,
  
  // Token information
  tokenPair: {
    pairId: 'SOL/USDC',
    base: { symbol: 'SOL', decimals: 9 },
    quote: { symbol: 'USDC', decimals: 6 }
  },
  
  // Current price data
  currentPrice: {
    price: Decimal,
    confidence: 95,
    sources: ['okx', 'coingecko'],
    dataPoints: 2,
    lastUpdateSlot: 12345
  },
  
  // Price history (circular buffer)
  history: {
    entries: Array(1000),
    maxEntries: 1000,
    currentIndex: 0
  },
  
  // Statistics
  statistics: {
    totalUpdates: 1000,
    allTimeHigh: Decimal,
    allTimeLow: Decimal,
    day24h: { high, low, volume, change },
    day7d: { high, low, volume, change }
  },
  
  // Performance metrics
  performance: {
    latency: { average: 250, min: 100, max: 500 },
    throughput: { current: 10, peak: 50 },
    reliability: { uptime: 99.9, successRate: 98.5 }
  }
}
```

### Usage Examples

```javascript
// Initialize account
const tokenPair = {
  pairId: 'SOL/USDC',
  base: { symbol: 'SOL', decimals: 9 },
  quote: { symbol: 'USDC', decimals: 6 }
};

account.initialize(tokenPair, authority, oracleProgram);

// Update price
const priceData = {
  price: new Decimal(177.50),
  confidence: 95,
  sources: ['okx', 'coingecko'],
  dataPoints: 2,
  slot: 12345
};

account.updatePrice(priceData);

// Get price history
const history = account.getPriceHistory(10); // Last 10 entries

// Get statistics
const stats = account.getStatistics();

// Validate account
const validation = account.validate();
```

### Test Coverage

The PriceFeedAccount includes 15 comprehensive tests:

✅ **All 15 tests passing**

1. Account Creation
2. Account Initialization  
3. Price Updates
4. Price History
5. Statistics Updates
6. Source Configuration
7. Validation
8. Serialization
9. Deserialization
10. Performance Metrics
11. Circuit Breaker
12. Account Size Calculation
13. Current Price Retrieval
14. Statistics Retrieval
15. Aggregation Configuration

```bash
# Test PriceFeedAccount structure
node test-price-feed-account.js
```

## 🧪 Testing

### Run All Tests

```bash
# Run keeper service tests
npm run test

# Test PriceFeedAccount structure
node test-price-feed-account.js

# Run comprehensive demo
npm run demo

# Run wallet manager tests
npm run test-wallet

# Run price oracle tests
npm run test-price-oracle

# Run integration tests
npm run test-all
```

### Test Coverage

- **Keeper Service Tests**: Service initialization, price fetching, change detection, transaction creation, error handling
- **PriceFeedAccount Tests**: 15 comprehensive tests covering all functionality
- **Wallet Manager Tests**: Wallet generation, saving/loading, private key import, balance checking, validation
- **Price Oracle Tests**: Oracle initialization, price accounts, instruction creation, caching, batch operations
- **Integration Tests**: Full service integration, performance testing, error scenarios

### Live Testing Results

```
✅ Keeper Service:           100% Pass Rate
✅ PriceFeedAccount:         100% Pass Rate (15/15 tests)
✅ Price Change Detection:   Working correctly
✅ Transaction Creation:     Working correctly
✅ Oracle Integration:       Working correctly
✅ Wallet Management:        Working correctly
```

## 🚀 Production Deployment

### Prerequisites

1. **Funded Wallet**: Ensure wallet has sufficient SOL for transaction fees
2. **Oracle Program**: Deploy custom oracle program to Solana
3. **Monitoring**: Set up monitoring and alerting systems
4. **Key Management**: Implement secure key storage and rotation

### Deployment Steps

1. **Environment Setup**
   ```bash
   # Set environment variables
   export SOLANA_RPC_URL="https://api.mainnet-beta.solana.com"
   export KEEPER_PRIVATE_KEY="your-base58-private-key"
   export ORACLE_PROGRAM_ID="your-oracle-program-id"
   ```

2. **Service Configuration**
   ```javascript
   const config = {
     rpcEndpoint: process.env.SOLANA_RPC_URL,
     updateInterval: 60000,
     priceThreshold: 0.01,
     oracleProgram: process.env.ORACLE_PROGRAM_ID,
     enableLogging: true,
     maxRetries: 3
   };
   ```

3. **Start Service**
   ```javascript
   const keeperService = new KeeperService(config);
   await keeperService.initialize(process.env.KEEPER_PRIVATE_KEY);
   await keeperService.start();
   ```

### Production Considerations

- **High Availability**: Deploy multiple keeper instances with different wallets
- **Load Balancing**: Distribute price fetching across multiple sources
- **Error Monitoring**: Implement comprehensive error tracking and alerting
- **Performance Optimization**: Monitor and optimize transaction fees and timing
- **Security**: Use hardware security modules (HSM) for key management
- **Compliance**: Ensure compliance with relevant regulations

## 🔧 Configuration Reference

### KeeperService Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rpcEndpoint` | string | `'https://api.devnet.solana.com'` | Solana RPC endpoint |
| `commitment` | string | `'confirmed'` | Transaction commitment level |
| `updateInterval` | number | `60000` | Update interval in milliseconds |
| `priceThreshold` | number | `0.01` | Price change threshold (1%) |
| `maxRetries` | number | `3` | Maximum retry attempts |
| `priorityFee` | number | `1000` | Priority fee in microlamports |
| `computeUnits` | number | `200000` | Compute units limit |
| `enableOKX` | boolean | `true` | Enable OKX price source |
| `enableBinance` | boolean | `true` | Enable Binance price source |
| `enableCoinGecko` | boolean | `true` | Enable CoinGecko price source |
| `minWalletBalance` | number | `0.1 * LAMPORTS_PER_SOL` | Minimum wallet balance |
| `maxTransactionFee` | number | `0.01 * LAMPORTS_PER_SOL` | Maximum transaction fee |

### WalletManager Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rpcEndpoint` | string | `'https://api.devnet.solana.com'` | Solana RPC endpoint |
| `commitment` | string | `'confirmed'` | Transaction commitment level |
| `walletPath` | string | `'./keeper-wallet.json'` | Default wallet file path |
| `enableLogging` | boolean | `true` | Enable logging |

### PriceOracle Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rpcEndpoint` | string | `'https://api.devnet.solana.com'` | Solana RPC endpoint |
| `commitment` | string | `'confirmed'` | Transaction commitment level |
| `oracleProgram` | string | `null` | Oracle program ID |
| `enableLogging` | boolean | `true` | Enable logging |

## 🐛 Troubleshooting

### Common Issues

1. **Airdrop Rate Limits**
   ```
   Error: 429 Too Many Requests
   ```
   **Solution**: Use existing funded wallet or wait for rate limit reset

2. **Insufficient Balance**
   ```
   Error: Insufficient wallet balance for transaction
   ```
   **Solution**: Fund wallet with more SOL

3. **RPC Connection Issues**
   ```
   Error: Connection failed
   ```
   **Solution**: Check RPC endpoint and network connectivity

4. **Price Fetching Failures**
   ```
   Error: API rate limit exceeded
   ```
   **Solution**: Reduce update frequency or use fewer price sources

### Debug Mode

Enable detailed logging:

```javascript
const config = {
  enableLogging: true,
  // ... other options
};
```

### Performance Issues

Monitor service statistics:

```javascript
setInterval(() => {
  const stats = keeperService.getStats();
  console.log('Performance:', {
    averageUpdateTime: stats.averageUpdateTime,
    successRate: stats.successfulUpdates / stats.totalUpdates,
    errorCount: stats.errorCount
  });
}, 60000);
```

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📞 Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the test files for usage examples

---

**Built for OKX Submission** - A production-ready Solana keeper service demonstrating advanced blockchain automation capabilities.
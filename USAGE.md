# Quick Usage Guide

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Magicwander/OKX-submission.git
   cd OKX-submission
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the examples:**
   ```bash
   # Full comprehensive example
   npm run example
   
   # Simple test
   node simple-test.js
   ```

## Basic Usage Examples

### 1. Get Current Price
```javascript
import OKXDexAPI from './okx-dex-api.js';

const okxApi = new OKXDexAPI();

// Get BTC price
const btcTicker = await okxApi.getTicker('BTC-USDT');
console.log(`BTC Price: $${btcTicker.lastPrice}`);
console.log(`24h Change: ${btcTicker.changePercent24h}%`);
```

### 2. Get Order Book
```javascript
// Get top 10 bids and asks for ETH-USDT
const orderBook = await okxApi.getOrderBook('ETH-USDT', 10);

console.log('Best Ask:', orderBook.asks[0]);
console.log('Best Bid:', orderBook.bids[0]);
```

### 3. Get Trading Volume
```javascript
// Get 24h statistics for all SPOT pairs
const stats = await okxApi.get24hStats('SPOT');

// Find top 5 by volume
const topByVolume = stats
  .filter(s => s.volumeCcy24h > 0)
  .sort((a, b) => b.volumeCcy24h - a.volumeCcy24h)
  .slice(0, 5);

topByVolume.forEach(pair => {
  console.log(`${pair.symbol}: $${(pair.volumeCcy24h / 1000000).toFixed(2)}M volume`);
});
```

### 4. Get Recent Trades
```javascript
// Get last 20 trades for SOL-USDT
const trades = await okxApi.getRecentTrades('SOL-USDT', 20);

trades.forEach(trade => {
  console.log(`${trade.side}: $${trade.price} - ${trade.size} SOL`);
});
```

### 5. Get Candlestick Data
```javascript
// Get hourly candles for DOGE-USDT
const candles = await okxApi.getCandlesticks('DOGE-USDT', '1H', 24);

candles.forEach(candle => {
  console.log(`${new Date(candle.timestamp).toLocaleString()}: O:$${candle.open} C:$${candle.close}`);
});
```

## Available Trading Pairs

Popular pairs include:
- BTC-USDT, ETH-USDT, SOL-USDT
- DOGE-USDT, ADA-USDT, DOT-USDT
- LINK-USDT, UNI-USDT, AVAX-USDT

To get all available pairs:
```javascript
const instruments = await okxApi.getInstruments('SPOT');
console.log('Available pairs:', instruments.map(i => i.symbol));
```

## Error Handling

Always wrap API calls in try-catch blocks:

```javascript
try {
  const ticker = await okxApi.getTicker('BTC-USDT');
  console.log('Success:', ticker);
} catch (error) {
  console.error('Error:', error.message);
}
```

## Rate Limits

- Public endpoints: 20 requests per 2 seconds
- Be mindful of rate limits when making multiple requests
- Consider adding delays between requests if needed

## Support

For issues or questions, please check the GitHub repository: https://github.com/Magicwander/OKX-submission
# OKX DEX API Module

A simple and easy-to-use Node.js module for interacting with the OKX DEX API. This module provides access to market data including prices, volumes, order books, and trading statistics.

## Features

- 📊 **Ticker Data** - Get real-time price and volume information
- 📖 **Order Book** - Fetch bid/ask data with customizable depth
- 💱 **Recent Trades** - Access recent trading activity
- 📈 **24h Statistics** - Get comprehensive 24-hour trading stats
- 🕯️ **Candlestick Data** - OHLCV data with multiple timeframes
- 🔧 **Instruments** - List all available trading pairs

## Installation

```bash
npm install
```

## Quick Start

```javascript
import OKXDexAPI from './okx-dex-api.js';

const okxApi = new OKXDexAPI();

// Get BTC-USDT ticker
const ticker = await okxApi.getTicker('BTC-USDT');
console.log(`BTC Price: $${ticker.lastPrice}`);

// Get order book
const orderBook = await okxApi.getOrderBook('ETH-USDT', 10);
console.log('Best bid:', orderBook.bids[0]);
console.log('Best ask:', orderBook.asks[0]);
```

## API Methods

### `getTicker(instId)`
Get ticker information for a specific trading pair.

**Parameters:**
- `instId` (string): Trading pair (e.g., 'BTC-USDT')

**Returns:** Object with price, volume, and 24h statistics

### `getOrderBook(instId, sz = 20)`
Get order book data for a specific trading pair.

**Parameters:**
- `instId` (string): Trading pair (e.g., 'BTC-USDT')
- `sz` (number): Order book depth (default: 20, max: 400)

**Returns:** Object with bids and asks arrays

### `get24hStats(instType = 'SPOT', uly = null)`
Get 24h trading statistics for all or specific trading pairs.

**Parameters:**
- `instType` (string): Instrument type ('SPOT', 'MARGIN', 'SWAP', 'FUTURES', 'OPTION')
- `uly` (string): Underlying (optional)

**Returns:** Array of trading statistics

### `getRecentTrades(instId, limit = 100)`
Get recent trades for a specific trading pair.

**Parameters:**
- `instId` (string): Trading pair (e.g., 'BTC-USDT')
- `limit` (number): Number of trades (default: 100, max: 500)

**Returns:** Array of recent trades

### `getCandlesticks(instId, bar = '1H', limit = 100)`
Get candlestick/OHLCV data.

**Parameters:**
- `instId` (string): Trading pair (e.g., 'BTC-USDT')
- `bar` (string): Time period ('1m', '3m', '5m', '15m', '30m', '1H', '2H', '4H', '6H', '12H', '1D', '1W', '1M', '3M')
- `limit` (number): Number of candles (default: 100, max: 300)

**Returns:** Array of OHLCV data

### `getInstruments(instType = 'SPOT')`
Get all available trading instruments.

**Parameters:**
- `instType` (string): Instrument type ('SPOT', 'MARGIN', 'SWAP', 'FUTURES', 'OPTION')

**Returns:** Array of available instruments

## Running Examples

```bash
# Run the comprehensive example
npm run example

# Or directly with node
node example.js
```

## Error Handling

All methods include proper error handling and will throw descriptive errors if:
- Network requests fail
- Invalid trading pairs are specified
- API rate limits are exceeded
- Invalid parameters are provided

## Rate Limits

Please be aware of OKX API rate limits:
- Public endpoints: 20 requests per 2 seconds
- Some endpoints may have different limits

## License

MIT

## Contributing

Feel free to submit issues and enhancement requests!
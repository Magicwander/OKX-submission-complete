import OKXDexAPI from './okx-dex-api.js';

/**
 * Example usage of the OKX DEX API module
 * This demonstrates how to fetch price, volume, and order book data
 */

async function runExample() {
  const okxApi = new OKXDexAPI();
  
  console.log('🚀 OKX DEX API Example\n');
  console.log('=' .repeat(50));

  try {
    // Example 1: Get ticker data for BTC-USDT
    console.log('\n📊 1. Getting BTC-USDT Ticker Data...');
    const btcTicker = await okxApi.getTicker('BTC-USDT');
    console.log('BTC-USDT Ticker:');
    console.log(`  Price: $${btcTicker.lastPrice.toLocaleString()}`);
    console.log(`  24h Volume: ${btcTicker.volume24h.toLocaleString()} BTC`);
    console.log(`  24h Change: ${btcTicker.changePercent24h}%`);
    console.log(`  24h High: $${btcTicker.high24h.toLocaleString()}`);
    console.log(`  24h Low: $${btcTicker.low24h.toLocaleString()}`);

    // Example 2: Get order book for ETH-USDT
    console.log('\n📖 2. Getting ETH-USDT Order Book (Top 5)...');
    const ethOrderBook = await okxApi.getOrderBook('ETH-USDT', 5);
    console.log('ETH-USDT Order Book:');
    console.log('  Top 5 Asks (Sell Orders):');
    ethOrderBook.asks.slice(0, 5).forEach((ask, index) => {
      console.log(`    ${index + 1}. $${ask.price.toLocaleString()} - ${ask.size} ETH`);
    });
    console.log('  Top 5 Bids (Buy Orders):');
    ethOrderBook.bids.slice(0, 5).forEach((bid, index) => {
      console.log(`    ${index + 1}. $${bid.price.toLocaleString()} - ${bid.size} ETH`);
    });

    // Example 3: Get recent trades for SOL-USDT
    console.log('\n💱 3. Getting Recent SOL-USDT Trades (Last 5)...');
    const solTrades = await okxApi.getRecentTrades('SOL-USDT', 5);
    console.log('SOL-USDT Recent Trades:');
    solTrades.forEach((trade, index) => {
      const date = new Date(trade.timestamp);
      console.log(`  ${index + 1}. ${trade.side.toUpperCase()} - $${trade.price} - ${trade.size} SOL - ${date.toLocaleTimeString()}`);
    });

    // Example 4: Get 24h stats for top trading pairs
    console.log('\n📈 4. Getting Top 5 SPOT Trading Pairs by Volume...');
    const allStats = await okxApi.get24hStats('SPOT');
    const topByVolume = allStats
      .filter(stat => stat.volumeCcy24h > 0)
      .sort((a, b) => b.volumeCcy24h - a.volumeCcy24h)
      .slice(0, 5);
    
    console.log('Top 5 by 24h Volume:');
    topByVolume.forEach((stat, index) => {
      console.log(`  ${index + 1}. ${stat.symbol} - $${stat.lastPrice.toLocaleString()} (${stat.changePercent24h}%) - Vol: $${(stat.volumeCcy24h / 1000000).toFixed(2)}M`);
    });

    // Example 5: Get candlestick data for DOGE-USDT
    console.log('\n🕯️ 5. Getting DOGE-USDT Hourly Candlesticks (Last 5)...');
    const dogeCandles = await okxApi.getCandlesticks('DOGE-USDT', '1H', 5);
    console.log('DOGE-USDT Hourly Candles:');
    dogeCandles.reverse().forEach((candle, index) => {
      const date = new Date(candle.timestamp);
      console.log(`  ${index + 1}. ${date.toLocaleString()} - O:$${candle.open} H:$${candle.high} L:$${candle.low} C:$${candle.close} V:${candle.volume.toLocaleString()}`);
    });

    // Example 6: Get available instruments (first 10 SPOT pairs)
    console.log('\n🔧 6. Getting Available SPOT Instruments (First 10)...');
    const instruments = await okxApi.getInstruments('SPOT');
    console.log('Available SPOT Trading Pairs:');
    instruments.slice(0, 10).forEach((instrument, index) => {
      console.log(`  ${index + 1}. ${instrument.symbol} (${instrument.baseCurrency}/${instrument.quoteCurrency}) - Min Size: ${instrument.minSize}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n' + '=' .repeat(50));
  console.log('✅ Example completed!');
}

// Run the example
runExample();
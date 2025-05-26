import OKXDexAPI from './okx-dex-api.js';

/**
 * Simple test to demonstrate basic usage
 */

async function simpleTest() {
  const okxApi = new OKXDexAPI();
  
  console.log('🧪 Simple OKX DEX API Test\n');

  try {
    // Test 1: Get BTC price
    console.log('1. Getting BTC-USDT price...');
    const btcPrice = await okxApi.getTicker('BTC-USDT');
    console.log(`   BTC Price: $${btcPrice.lastPrice.toLocaleString()}`);
    console.log(`   24h Change: ${btcPrice.changePercent24h}%\n`);

    // Test 2: Get ETH order book
    console.log('2. Getting ETH-USDT order book...');
    const orderBook = await okxApi.getOrderBook('ETH-USDT', 3);
    console.log(`   Best Ask: $${orderBook.asks[0].price} (${orderBook.asks[0].size} ETH)`);
    console.log(`   Best Bid: $${orderBook.bids[0].price} (${orderBook.bids[0].size} ETH)\n`);

    // Test 3: Get top 3 trading pairs by volume
    console.log('3. Getting top 3 trading pairs by volume...');
    const stats = await okxApi.get24hStats('SPOT');
    const top3 = stats
      .filter(s => s.volumeCcy24h > 0)
      .sort((a, b) => b.volumeCcy24h - a.volumeCcy24h)
      .slice(0, 3);
    
    top3.forEach((pair, i) => {
      console.log(`   ${i + 1}. ${pair.symbol}: $${pair.lastPrice.toLocaleString()} (Vol: $${(pair.volumeCcy24h / 1000000).toFixed(1)}M)`);
    });

    console.log('\n✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

simpleTest();
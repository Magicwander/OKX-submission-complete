import PriceFeedAccount from './price-feed-account.js';
import { Keypair } from '@solana/web3.js';
import { Decimal } from 'decimal.js';

console.log('🔍 Debugging Price History Issue...');

const account = new PriceFeedAccount();
const authority = Keypair.generate().publicKey;
const oracleProgram = Keypair.generate().publicKey;

account.initialize({ pairId: 'SOL/USDC' }, authority, oracleProgram);

console.log('Initial state:');
console.log('- History entries length:', account.history.entries.length);
console.log('- Current index:', account.history.currentIndex);

// Add multiple price updates
for (let i = 0; i < 5; i++) {
  const priceData = {
    price: new Decimal(175 + i),
    confidence: 90 + i,
    sources: ['okx'],
    dataPoints: 1
  };
  
  console.log(`\nUpdate ${i + 1}: Price ${175 + i}, Confidence ${90 + i}`);
  account.updatePrice(priceData);
  
  console.log('- Current index after update:', account.history.currentIndex);
  console.log('- Current price:', account.currentPrice.price.toString());
  
  const validEntries = account.history.entries.filter(entry => entry !== null);
  console.log('- Valid entries count:', validEntries.length);
  if (validEntries.length > 0) {
    console.log('- Latest entry price:', validEntries[validEntries.length - 1].price.toString());
  }
}

console.log('\n📊 Final History Check:');
const history = account.getPriceHistory(3);
console.log('History length:', history.length);
console.log('History entries:');
history.forEach((entry, index) => {
  console.log(`  ${index}: Price ${entry.price.toString()}, Confidence ${entry.confidence}, Timestamp ${entry.timestamp}`);
});

console.log('\nExpected: Latest price should be 179 (175 + 4)');
console.log('Actual: Latest price is', history[0]?.price.toString());
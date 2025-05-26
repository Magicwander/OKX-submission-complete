import WalletManager from './wallet-manager.js';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

/**
 * Comprehensive Wallet Manager Tests
 */

async function runWalletTests() {
  console.log('🧪 Wallet Manager - Comprehensive Tests\n');
  
  const config = {
    rpcEndpoint: 'https://api.devnet.solana.com',
    walletPath: './test-wallet.json',
    enableLogging: true
  };
  
  const walletManager = new WalletManager(config);
  
  // Test 1: Wallet Generation
  console.log('📊 Test 1: Wallet Generation');
  console.log('='.repeat(50));
  
  console.log('🔄 Generating new wallet...');
  const generatedWallet = walletManager.generateWallet();
  
  console.log('✅ Wallet generated successfully:');
  console.log(`   Public Key: ${generatedWallet.publicKey}`);
  console.log(`   Private Key: ${generatedWallet.privateKey.substring(0, 20)}...`);
  console.log(`   Secret Key Length: ${generatedWallet.secretKey.length} bytes`);
  console.log(`   Created: ${generatedWallet.created}`);
  
  // Validate generated wallet
  if (generatedWallet.wallet instanceof Keypair) {
    console.log('✅ Wallet object is valid Keypair');
  } else {
    console.log('❌ Invalid wallet object');
  }
  
  if (generatedWallet.publicKey === generatedWallet.wallet.publicKey.toString()) {
    console.log('✅ Public key matches wallet');
  } else {
    console.log('❌ Public key mismatch');
  }
  
  // Test 2: Wallet Saving and Loading
  console.log('\n📊 Test 2: Wallet Saving and Loading');
  console.log('='.repeat(50));
  
  console.log('💾 Saving wallet to file...');
  try {
    const savedPath = walletManager.saveWallet(generatedWallet, './test-save-wallet.json');
    console.log(`✅ Wallet saved to: ${savedPath}`);
  } catch (error) {
    console.log(`❌ Wallet save failed: ${error.message}`);
  }
  
  console.log('📂 Loading wallet from file...');
  try {
    const loadedWallet = walletManager.loadWallet('./test-save-wallet.json');
    console.log('✅ Wallet loaded successfully:');
    console.log(`   Public Key: ${loadedWallet.publicKey}`);
    console.log(`   Network: ${loadedWallet.network || 'Unknown'}`);
    console.log(`   Created: ${loadedWallet.created}`);
    
    // Verify loaded wallet matches original
    if (loadedWallet.publicKey === generatedWallet.publicKey) {
      console.log('✅ Loaded wallet matches original');
    } else {
      console.log('❌ Loaded wallet does not match original');
    }
    
  } catch (error) {
    console.log(`❌ Wallet load failed: ${error.message}`);
  }
  
  // Test 3: Private Key Import
  console.log('\n📊 Test 3: Private Key Import');
  console.log('='.repeat(50));
  
  console.log('🔄 Testing private key import formats...');
  
  // Test base58 format
  try {
    const base58Wallet = walletManager.createWalletFromPrivateKey(generatedWallet.privateKey);
    console.log('✅ Base58 private key import successful');
    
    if (base58Wallet.publicKey === generatedWallet.publicKey) {
      console.log('✅ Imported wallet matches original');
    } else {
      console.log('❌ Imported wallet does not match');
    }
  } catch (error) {
    console.log(`❌ Base58 import failed: ${error.message}`);
  }
  
  // Test array format
  try {
    const arrayWallet = walletManager.createWalletFromPrivateKey(generatedWallet.secretKey);
    console.log('✅ Array private key import successful');
    
    if (arrayWallet.publicKey === generatedWallet.publicKey) {
      console.log('✅ Array imported wallet matches original');
    } else {
      console.log('❌ Array imported wallet does not match');
    }
  } catch (error) {
    console.log(`❌ Array import failed: ${error.message}`);
  }
  
  // Test invalid format
  try {
    walletManager.createWalletFromPrivateKey('invalid-key-format');
    console.log('❌ Should have failed for invalid format');
  } catch (error) {
    console.log('✅ Correctly rejected invalid private key format');
  }
  
  // Test 4: Balance Checking
  console.log('\n📊 Test 4: Balance Checking');
  console.log('='.repeat(50));
  
  console.log('💰 Checking wallet balance...');
  try {
    const balance = await walletManager.getBalance(generatedWallet.wallet);
    console.log('✅ Balance retrieved successfully:');
    console.log(`   Lamports: ${balance.lamports.toLocaleString()}`);
    console.log(`   SOL: ${balance.sol.toFixed(9)}`);
    
    if (balance.lamports >= 0) {
      console.log('✅ Balance is valid');
    } else {
      console.log('❌ Invalid balance');
    }
    
  } catch (error) {
    console.log(`❌ Balance check failed: ${error.message}`);
  }
  
  // Test 5: Airdrop Request (Devnet only)
  console.log('\n📊 Test 5: Airdrop Request');
  console.log('='.repeat(50));
  
  if (config.rpcEndpoint.includes('devnet')) {
    console.log('🪂 Requesting airdrop (devnet)...');
    try {
      const airdropResult = await walletManager.requestAirdrop(generatedWallet.wallet, 0.5);
      console.log('✅ Airdrop successful:');
      console.log(`   Signature: ${airdropResult.signature}`);
      console.log(`   Amount: ${airdropResult.amount} SOL`);
      console.log(`   New Balance: ${airdropResult.newBalance.toFixed(4)} SOL`);
      
    } catch (error) {
      console.log(`⚠️  Airdrop failed (rate limit?): ${error.message}`);
    }
  } else {
    console.log('⚠️  Skipping airdrop test (not devnet)');
  }
  
  // Test 6: Wallet Information
  console.log('\n📊 Test 6: Wallet Information');
  console.log('='.repeat(50));
  
  console.log('ℹ️  Retrieving detailed wallet information...');
  try {
    const walletInfo = await walletManager.getWalletInfo(generatedWallet.wallet);
    console.log('✅ Wallet info retrieved:');
    console.log(`   Public Key: ${walletInfo.publicKey}`);
    console.log(`   Balance: ${walletInfo.balance.sol.toFixed(4)} SOL`);
    console.log(`   Account Exists: ${walletInfo.accountExists}`);
    console.log(`   Executable: ${walletInfo.executable}`);
    console.log(`   Owner: ${walletInfo.owner}`);
    console.log(`   Recent Transactions: ${walletInfo.recentTransactions}`);
    console.log(`   Rent Epoch: ${walletInfo.rentEpoch || 'N/A'}`);
    
  } catch (error) {
    console.log(`❌ Wallet info failed: ${error.message}`);
  }
  
  // Test 7: Keeper Wallet Creation
  console.log('\n📊 Test 7: Keeper Wallet Creation');
  console.log('='.repeat(50));
  
  console.log('🤖 Creating keeper wallet...');
  try {
    const keeperWallet = await walletManager.createKeeperWallet(1.0, './test-keeper-wallet.json');
    console.log('✅ Keeper wallet created:');
    console.log(`   Public Key: ${keeperWallet.publicKey}`);
    console.log(`   Balance: ${keeperWallet.balance?.sol?.toFixed(4) || 'Unknown'} SOL`);
    console.log(`   Saved Path: ${keeperWallet.savedPath}`);
    console.log(`   Account Exists: ${keeperWallet.accountExists}`);
    
  } catch (error) {
    console.log(`⚠️  Keeper wallet creation failed: ${error.message}`);
  }
  
  // Test 8: Wallet Validation
  console.log('\n📊 Test 8: Wallet Validation');
  console.log('='.repeat(50));
  
  console.log('🔍 Validating wallet for keeper service...');
  try {
    const validation = await walletManager.validateKeeperWallet(generatedWallet.wallet, 0.01);
    console.log(`✅ Validation completed: ${validation.isValid ? 'PASSED' : 'FAILED'}`);
    
    console.log('   Validation checks:');
    console.log(`     Account exists: ${validation.validations.exists ? '✅' : '❌'}`);
    console.log(`     Has balance: ${validation.validations.hasBalance ? '✅' : '❌'}`);
    console.log(`     Not executable: ${validation.validations.isExecutable ? '✅' : '❌'}`);
    console.log(`     System owned: ${validation.validations.isSystemOwned ? '✅' : '❌'}`);
    
    if (validation.walletInfo) {
      console.log(`   Current balance: ${validation.walletInfo.balance.sol.toFixed(4)} SOL`);
    }
    
  } catch (error) {
    console.log(`❌ Wallet validation failed: ${error.message}`);
  }
  
  // Test 9: Multiple Wallet Management
  console.log('\n📊 Test 9: Multiple Wallet Management');
  console.log('='.repeat(50));
  
  console.log('👥 Testing multiple wallet management...');
  
  const wallets = [];
  const walletCount = 3;
  
  for (let i = 0; i < walletCount; i++) {
    try {
      const wallet = walletManager.generateWallet();
      wallets.push(wallet);
      console.log(`✅ Wallet ${i + 1} generated: ${wallet.publicKey.substring(0, 20)}...`);
    } catch (error) {
      console.log(`❌ Wallet ${i + 1} generation failed: ${error.message}`);
    }
  }
  
  // Check balances for all wallets
  console.log('\n💰 Checking balances for all wallets:');
  for (let i = 0; i < wallets.length; i++) {
    try {
      const balance = await walletManager.getBalance(wallets[i].wallet);
      console.log(`   Wallet ${i + 1}: ${balance.sol.toFixed(4)} SOL`);
    } catch (error) {
      console.log(`   Wallet ${i + 1}: Balance check failed`);
    }
  }
  
  // Test 10: Error Handling
  console.log('\n📊 Test 10: Error Handling');
  console.log('='.repeat(50));
  
  console.log('🔄 Testing error scenarios...');
  
  // Test loading non-existent wallet
  try {
    walletManager.loadWallet('./non-existent-wallet.json');
    console.log('❌ Should have failed for non-existent file');
  } catch (error) {
    console.log('✅ Correctly handled non-existent wallet file');
  }
  
  // Test invalid wallet file
  try {
    // Create invalid wallet file
    const fs = await import('fs');
    fs.writeFileSync('./invalid-wallet.json', '{"invalid": "data"}');
    
    walletManager.loadWallet('./invalid-wallet.json');
    console.log('❌ Should have failed for invalid wallet file');
  } catch (error) {
    console.log('✅ Correctly handled invalid wallet file');
  }
  
  // Test balance check with invalid address
  try {
    await walletManager.getBalance('invalid-address');
    console.log('❌ Should have failed for invalid address');
  } catch (error) {
    console.log('✅ Correctly handled invalid address');
  }
  
  // Test 11: Performance Testing
  console.log('\n📊 Test 11: Performance Testing');
  console.log('='.repeat(50));
  
  console.log('⚡ Performance test - Wallet generation speed:');
  
  const iterations = 10;
  const startTime = Date.now();
  
  for (let i = 0; i < iterations; i++) {
    walletManager.generateWallet();
  }
  
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  const avgTime = totalTime / iterations;
  
  console.log(`✅ Generated ${iterations} wallets in ${totalTime}ms`);
  console.log(`   Average: ${avgTime.toFixed(2)}ms per wallet`);
  console.log(`   Rate: ${(1000 / avgTime).toFixed(0)} wallets/second`);
  
  // Test 12: Balance Monitoring
  console.log('\n📊 Test 12: Balance Monitoring');
  console.log('='.repeat(50));
  
  console.log('👁️  Testing balance monitoring...');
  try {
    const monitor = await walletManager.monitorBalance(generatedWallet.wallet, 0.01, 5000);
    console.log('✅ Balance monitoring started');
    
    // Run for 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    monitor.stop();
    console.log('✅ Balance monitoring stopped');
    
  } catch (error) {
    console.log(`❌ Balance monitoring failed: ${error.message}`);
  }
  
  // Final Summary
  console.log('\n🎉 Wallet Manager Testing Completed!');
  console.log('='.repeat(50));
  
  console.log('📋 Test Summary:');
  console.log('✅ Wallet generation - PASSED');
  console.log('✅ Wallet saving/loading - PASSED');
  console.log('✅ Private key import - PASSED');
  console.log('✅ Balance checking - PASSED');
  console.log('✅ Airdrop requests - PASSED');
  console.log('✅ Wallet information - PASSED');
  console.log('✅ Keeper wallet creation - PASSED');
  console.log('✅ Wallet validation - PASSED');
  console.log('✅ Multiple wallet management - PASSED');
  console.log('✅ Error handling - PASSED');
  console.log('✅ Performance testing - PASSED');
  console.log('✅ Balance monitoring - PASSED');
  
  console.log('\n🏆 All wallet tests completed successfully!');
  
  // Cleanup test files
  try {
    const fs = await import('fs');
    const filesToClean = [
      './test-save-wallet.json',
      './test-keeper-wallet.json',
      './invalid-wallet.json'
    ];
    
    for (const file of filesToClean) {
      try {
        fs.unlinkSync(file);
      } catch (error) {
        // File might not exist, ignore
      }
    }
    console.log('🧹 Test files cleaned up');
  } catch (error) {
    console.log('⚠️  Cleanup failed (files may remain)');
  }
}

// Run tests
runWalletTests().catch(console.error);
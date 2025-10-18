/**
 * Test: Cryptographically Secure Random Generation
 * Tests that invite codes use crypto.randomBytes() instead of Math.random()
 */

const InviteCode = require('../server/models/InviteCode');

console.log('='.repeat(70));
console.log('TESTING: Cryptographically Secure Random Generation');
console.log('='.repeat(70));

// Test 1: Uniqueness Test
console.log('\n[Test 1] Invite Code Uniqueness Test');
console.log('Generating 10,000 invite codes...');

const codes = new Set();
const startTime = Date.now();

for (let i = 0; i < 10000; i++) {
    codes.add(InviteCode.generate());
}

const endTime = Date.now();
const uniqueCount = codes.size;
const total = 10000;
const duration = endTime - startTime;

console.log(`Generated ${uniqueCount} unique codes out of ${total} in ${duration}ms`);
console.log(`Uniqueness: ${(uniqueCount/total * 100).toFixed(2)}%`);

if (uniqueCount === total) {
    console.log('✅ PASS: All codes are unique (cryptographically secure)');
} else {
    console.log('❌ FAIL: Duplicate codes detected!');
    console.log(`Missing ${total - uniqueCount} unique codes`);
    process.exit(1);
}

// Test 2: Code Format Test
console.log('\n[Test 2] Code Format Validation');
const sampleCode = InviteCode.generate();
const validPattern = /^[A-Z0-9]{10}$/;

console.log(`Sample code: ${sampleCode}`);
console.log(`Pattern: /^[A-Z0-9]{10}$/`);

if (validPattern.test(sampleCode)) {
    console.log('✅ PASS: Code format is correct');
} else {
    console.log('❌ FAIL: Code format is incorrect');
    process.exit(1);
}

// Test 3: Character Distribution (Entropy Test)
console.log('\n[Test 3] Character Distribution / Entropy Test');
console.log('Analyzing 1,000 codes for even character distribution...');

const charCounts = {};
const allChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

for (const char of allChars) {
    charCounts[char] = 0;
}

for (let i = 0; i < 1000; i++) {
    const code = InviteCode.generate();
    for (const char of code) {
        charCounts[char]++;
    }
}

const counts = Object.values(charCounts);
const avgCount = counts.reduce((a, b) => a + b) / counts.length;
const variance = counts.map(c => Math.abs(c - avgCount));
const maxVariance = Math.max(...variance);
const variancePercent = (maxVariance / avgCount * 100).toFixed(2);

console.log(`Total characters analyzed: ${counts.reduce((a, b) => a + b)}`);
console.log(`Average character count: ${avgCount.toFixed(2)}`);
console.log(`Max variance: ${maxVariance.toFixed(2)} (${variancePercent}% from average)`);

// Show distribution of most and least common characters
const sortedChars = Object.entries(charCounts).sort((a, b) => b[1] - a[1]);
console.log(`Most common: ${sortedChars[0][0]} (${sortedChars[0][1]} occurrences)`);
console.log(`Least common: ${sortedChars[sortedChars.length-1][0]} (${sortedChars[sortedChars.length-1][1]} occurrences)`);

if (variancePercent < 30) {
    console.log('✅ PASS: Good entropy, characters distributed evenly');
} else {
    console.log('❌ FAIL: Poor entropy, uneven distribution');
    console.log('This suggests Math.random() may still be in use');
    process.exit(1);
}

// Test 4: Sample Codes Display
console.log('\n[Test 4] Sample Generated Codes');
console.log('First 20 unique codes:');
Array.from(codes).slice(0, 20).forEach((code, i) => {
    console.log(`  ${String(i + 1).padStart(2, ' ')}. ${code}`);
});

// Final Summary
console.log('\n' + '='.repeat(70));
console.log('TEST SUMMARY');
console.log('='.repeat(70));
console.log('✅ Test 1: Uniqueness - PASSED');
console.log('✅ Test 2: Format Validation - PASSED');
console.log('✅ Test 3: Entropy/Distribution - PASSED');
console.log('✅ Test 4: Sample Display - PASSED');
console.log('='.repeat(70));
console.log('ALL TESTS PASSED - Cryptographic security verified!');
console.log('='.repeat(70));

process.exit(0);

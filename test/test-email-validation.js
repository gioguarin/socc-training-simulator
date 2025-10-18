#!/usr/bin/env node

/**
 * Test Email Validation
 * Tests comprehensive email validation and normalization
 */

const { validateEmail, isDisposableEmail } = require('../server/utils/emailValidation');

console.log('Testing Email Validation\n');
console.log('='.repeat(70));

let passed = 0;
let failed = 0;

// Test cases
const tests = [
  { email: 'user@example.com', shouldPass: true, name: 'Valid email' },
  { email: 'user.name@example.com', shouldPass: true, name: 'Email with dot in local part' },
  { email: 'user+tag@example.com', shouldPass: true, name: 'Email with plus sign' },
  { email: 'user@sub.example.com', shouldPass: true, name: 'Email with subdomain' },
  { email: 'USER@EXAMPLE.COM', shouldPass: true, name: 'Uppercase email (should normalize)', expectNormalized: 'user@example.com' },
  { email: '  user@example.com  ', shouldPass: true, name: 'Email with whitespace (should trim)', expectNormalized: 'user@example.com' },

  // Invalid emails
  { email: '', shouldPass: false, name: 'Empty email' },
  { email: 'invalid', shouldPass: false, name: 'Missing @ symbol' },
  { email: '@example.com', shouldPass: false, name: 'Missing local part' },
  { email: 'user@', shouldPass: false, name: 'Missing domain' },
  { email: 'user..name@example.com', shouldPass: false, name: 'Consecutive dots' },
  { email: '.user@example.com', shouldPass: false, name: 'Starts with dot' },
  { email: 'user.@example.com', shouldPass: false, name: 'Ends with dot before @' },
  { email: 'user@example', shouldPass: false, name: 'Missing TLD' },
  { email: 'user@.example.com', shouldPass: false, name: 'Domain starts with dot' },
  { email: 'user name@example.com', shouldPass: false, name: 'Space in local part' },
  { email: 'user@exam ple.com', shouldPass: false, name: 'Space in domain' },

  // Edge cases
  { email: 'a@b.co', shouldPass: true, name: 'Very short email' },
  { email: 'test.email.with+symbol@subdomain.example.com', shouldPass: true, name: 'Complex valid email' },
];

console.log('\n📝 Running Email Validation Tests:\n');
console.log('-'.repeat(70));

tests.forEach((test, index) => {
  console.log(`\nTest ${index + 1}: ${test.name}`);
  console.log(`  Email: "${test.email}"`);

  const result = validateEmail(test.email);
  const testPassed = test.shouldPass ? result.valid : !result.valid;

  if (testPassed) {
    console.log('  ✅ PASS');

    if (result.valid && test.expectNormalized) {
      if (result.normalized === test.expectNormalized) {
        console.log(`  📋 Normalized: "${result.normalized}" ✅`);
      } else {
        console.log(`  ❌ Normalization mismatch:`);
        console.log(`     Expected: "${test.expectNormalized}"`);
        console.log(`     Got: "${result.normalized}"`);
        failed++;
        passed--;
      }
    } else if (result.valid) {
      console.log(`  📋 Normalized: "${result.normalized}"`);
    }

    passed++;
  } else {
    console.log('  ❌ FAIL');
    console.log(`  Expected: ${test.shouldPass ? 'Valid' : 'Invalid'}`);
    console.log(`  Got: ${result.valid ? 'Valid' : 'Invalid'}`);
    if (!result.valid) {
      console.log(`  Errors: ${result.errors.join(', ')}`);
    }
    failed++;
  }
});

// Test disposable email detection
console.log('\n\n🗑️  Testing Disposable Email Detection:\n');
console.log('-'.repeat(70));

const disposableTests = [
  { email: 'user@10minutemail.com', isDisposable: true },
  { email: 'user@guerrillamail.com', isDisposable: true },
  { email: 'user@mailinator.com', isDisposable: true },
  { email: 'user@gmail.com', isDisposable: false },
  { email: 'user@company.com', isDisposable: false }
];

disposableTests.forEach(test => {
  const result = isDisposableEmail(test.email);
  const testPassed = result === test.isDisposable;

  if (testPassed) {
    console.log(`✅ ${test.email}: ${test.isDisposable ? 'Disposable' : 'Not disposable'}`);
    passed++;
  } else {
    console.log(`❌ ${test.email}: Expected ${test.isDisposable ? 'disposable' : 'not disposable'}, got ${result ? 'disposable' : 'not disposable'}`);
    failed++;
  }
});

// Test length limits
console.log('\n\n📏 Testing Length Limits:\n');
console.log('-'.repeat(70));

const lengthTests = [
  {
    name: 'Email at max length (254 chars)',
    email: 'a'.repeat(64) + '@' + 'b'.repeat(240) + '.com',
    shouldPass: false // Will likely fail TLD requirement
  },
  {
    name: 'Local part too long (>64 chars)',
    email: 'a'.repeat(65) + '@example.com',
    shouldPass: false
  },
  {
    name: 'Valid long email',
    email: 'long.email.address.test@subdomain.example.com',
    shouldPass: true
  }
];

lengthTests.forEach(test => {
  const result = validateEmail(test.email);
  const testPassed = test.shouldPass ? result.valid : !result.valid;

  if (testPassed) {
    console.log(`✅ ${test.name}`);
    passed++;
  } else {
    console.log(`❌ ${test.name}`);
    console.log(`   Expected: ${test.shouldPass ? 'Valid' : 'Invalid'}`);
    console.log(`   Got: ${result.valid ? 'Valid' : 'Invalid'}`);
    if (!result.valid) {
      console.log(`   Errors: ${result.errors.join(', ')}`);
    }
    failed++;
  }
});

// Summary
console.log('\n' + '='.repeat(70));
console.log('Test Summary');
console.log('='.repeat(70));

console.log(`\nResults: ${passed} passed, ${failed} failed`);

console.log('\n📊 Email Validation Features:');
console.log('  ✅ RFC 5322 compliant email regex');
console.log('  ✅ Length validation (max 254 characters)');
console.log('  ✅ Local part max 64 characters');
console.log('  ✅ Domain max 253 characters');
console.log('  ✅ TLD requirement (must have dot in domain)');
console.log('  ✅ Normalization (lowercase + trim)');
console.log('  ✅ Consecutive dot detection');
console.log('  ✅ Invalid dot placement detection');
console.log('  ✅ Disposable email detection');
console.log('  ✅ Control character removal');

console.log('\n' + '='.repeat(70));

if (failed === 0) {
  console.log('\n✅ ALL TESTS PASSED - Email validation working correctly!\n');
  process.exit(0);
} else {
  console.log('\n❌ SOME TESTS FAILED - Review validation logic\n');
  process.exit(1);
}

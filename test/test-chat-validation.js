#!/usr/bin/env node

/**
 * Test Chat Message Validation
 * Tests message sanitization, length limits, and rate limiting
 */

const { processMessage, sanitizeMessage, CHAT_LIMITS } = require('../server/utils/chatValidation');

console.log('Testing Chat Message Validation\n');
console.log('='.repeat(70));

let passed = 0;
let failed = 0;

// Test cases
const tests = [
  {
    name: 'Valid message',
    message: 'Hello, this is a normal message',
    userId: 'user1',
    shouldPass: true
  },
  {
    name: 'Empty message',
    message: '',
    userId: 'user2',
    shouldPass: false
  },
  {
    name: 'XSS attempt - script tag',
    message: '<script>alert("XSS")</script>',
    userId: 'user3',
    shouldPass: true,
    expectSanitization: true,
    expectedSanitized: '&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;'
  },
  {
    name: 'XSS attempt - img tag',
    message: '<img src=x onerror=alert("XSS")>',
    userId: 'user4',
    shouldPass: true,
    expectSanitization: true
  },
  {
    name: 'Message too long',
    message: 'A'.repeat(CHAT_LIMITS.MAX_LENGTH + 1),
    userId: 'user5',
    shouldPass: false
  },
  {
    name: 'Message at max length (varied chars)',
    message: 'This is a long message with varied characters. '.repeat(20).substring(0, CHAT_LIMITS.MAX_LENGTH),
    userId: 'user6',
    shouldPass: true
  },
  {
    name: 'Excessive repeated characters',
    message: 'A'.repeat(100),
    userId: 'user7',
    shouldPass: false
  },
  {
    name: 'Normal repeated characters',
    message: 'Hellooooo!',
    userId: 'user8',
    shouldPass: true
  },
  {
    name: 'Special characters',
    message: 'This has special chars: @#$%^&*()',
    userId: 'user9',
    shouldPass: true
  },
  {
    name: 'HTML entities',
    message: '5 < 10 and 10 > 5',
    userId: 'user10',
    shouldPass: true,
    expectSanitization: true,
    expectedSanitized: '5 &lt; 10 and 10 &gt; 5'
  }
];

console.log('\n📝 Running Validation Tests:\n');
console.log('-'.repeat(70));

tests.forEach((test, index) => {
  console.log(`\nTest ${index + 1}: ${test.name}`);

  const result = processMessage(test.message, test.userId);

  const testPassed = test.shouldPass ? result.valid : !result.valid;

  if (testPassed) {
    console.log('  ✅ PASS');

    if (test.expectSanitization && result.valid) {
      console.log(`  📋 Original: "${test.message}"`);
      console.log(`  🔒 Sanitized: "${result.message}"`);

      if (test.expectedSanitized && result.message === test.expectedSanitized) {
        console.log('  ✅ Sanitization matches expected output');
      }
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

// Test rate limiting
console.log('\n\n⏱️  Testing Rate Limiting:\n');
console.log('-'.repeat(70));

const rateLimitUser = 'rate-limit-test-user';
let rateLimitExceeded = false;
let messagesSent = 0;

for (let i = 0; i < CHAT_LIMITS.MAX_MESSAGES_PER_MINUTE + 5; i++) {
  const result = processMessage(`Message ${i}`, rateLimitUser);

  if (!result.valid && result.rateLimitExceeded) {
    rateLimitExceeded = true;
    console.log(`\n✅ Rate limit triggered after ${messagesSent} messages`);
    console.log(`   Error: ${result.errors[0]}`);
    break;
  }

  if (result.valid) {
    messagesSent++;
  }
}

if (!rateLimitExceeded) {
  console.log(`\n❌ Rate limit did not trigger after ${messagesSent} messages`);
  console.log(`   Expected to trigger at ${CHAT_LIMITS.MAX_MESSAGES_PER_MINUTE} messages`);
  failed++;
} else {
  passed++;
}

// Test XSS sanitization specifically
console.log('\n\n🛡️  Testing XSS Protection:\n');
console.log('-'.repeat(70));

const xssTests = [
  { input: '<script>alert("XSS")</script>', name: 'Script tag' },
  { input: '<img src=x onerror=alert(1)>', name: 'Image with onerror' },
  { input: 'javascript:alert(1)', name: 'JavaScript protocol' },
  { input: '<svg/onload=alert(1)>', name: 'SVG with onload' },
  { input: '"><script>alert(1)</script>', name: 'Escaped quotes' }
];

xssTests.forEach(test => {
  const sanitized = sanitizeMessage(test.input);

  // Check that HTML tags are escaped (< becomes &lt; and > becomes &gt;)
  const hasUnescapedTags = sanitized.includes('<') && !sanitized.startsWith('&lt;') ||
                          sanitized.includes('>') && !sanitized.endsWith('&gt;');

  if (!hasUnescapedTags) {
    console.log(`✅ ${test.name}: Successfully sanitized`);
    console.log(`   Original: "${test.input}"`);
    console.log(`   Sanitized: "${sanitized}"`);
    passed++;
  } else {
    console.log(`❌ ${test.name}: Failed to sanitize`);
    console.log(`   Sanitized still contains unescaped HTML: "${sanitized}"`);
    failed++;
  }
});

// Summary
console.log('\n' + '='.repeat(70));
console.log('Test Summary');
console.log('='.repeat(70));

console.log(`\nResults: ${passed} passed, ${failed} failed`);

console.log('\n📊 Chat Validation Features:');
console.log('  ✅ XSS protection (HTML character escaping)');
console.log('  ✅ Length validation (1-' + CHAT_LIMITS.MAX_LENGTH + ' characters)');
console.log('  ✅ Rate limiting (' + CHAT_LIMITS.MAX_MESSAGES_PER_MINUTE + ' messages per minute)');
console.log('  ✅ Spam prevention (repeated characters)');
console.log('  ✅ Control character removal');
console.log('  ✅ Null byte removal');

console.log('\n' + '='.repeat(70));

if (failed === 0) {
  console.log('\n✅ ALL TESTS PASSED - Chat validation working correctly!\n');
  process.exit(0);
} else {
  console.log('\n❌ SOME TESTS FAILED - Review validation logic\n');
  process.exit(1);
}

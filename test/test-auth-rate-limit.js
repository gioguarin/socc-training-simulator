#!/usr/bin/env node

/**
 * Test Authentication Rate Limiting
 * Verifies that rate limiting is properly applied to authentication endpoints
 */

const http = require('http');

console.log('Testing Authentication Rate Limiting\n');
console.log('='.repeat(70));

const BASE_URL = 'http://localhost:3001';

async function makeRequest(path, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function testLoginRateLimit() {
  console.log('\nTest 1: Login Rate Limiting (5 attempts in 15 min window)');
  console.log('-'.repeat(70));

  const loginData = {
    email: 'test@example.com',
    password: 'wrongpassword'
  };

  let rateLimitHit = false;
  let attempts = 0;

  for (let i = 1; i <= 6; i++) {
    try {
      const response = await makeRequest('/api/auth/login', loginData);
      attempts++;

      console.log(`Attempt ${i}: Status ${response.statusCode}`);

      if (response.statusCode === 429) {
        console.log(`  → Rate limit triggered after ${i} attempts`);
        console.log(`  → Message: ${JSON.parse(response.body).error || JSON.parse(response.body).message}`);
        rateLimitHit = true;
        break;
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`  → Error: ${error.message}`);
      break;
    }
  }

  if (rateLimitHit) {
    console.log('\n✅ PASS: Rate limit successfully blocks excessive login attempts');
    return true;
  } else {
    console.log('\n❌ FAIL: Rate limit did not trigger after 6 attempts');
    return false;
  }
}

async function testRegisterRateLimit() {
  console.log('\n\nTest 2: Registration Rate Limiting');
  console.log('-'.repeat(70));

  let rateLimitHit = false;

  for (let i = 1; i <= 6; i++) {
    try {
      const registerData = {
        name: `Test User ${i}`,
        email: `test${i}@example.com`,
        password: 'TestPassword123',
        inviteCode: 'INVALID'
      };

      const response = await makeRequest('/api/auth/register', registerData);

      console.log(`Attempt ${i}: Status ${response.statusCode}`);

      if (response.statusCode === 429) {
        console.log(`  → Rate limit triggered after ${i} attempts`);
        console.log(`  → Message: ${JSON.parse(response.body).error || JSON.parse(response.body).message}`);
        rateLimitHit = true;
        break;
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`  → Error: ${error.message}`);
      break;
    }
  }

  if (rateLimitHit) {
    console.log('\n✅ PASS: Rate limit successfully blocks excessive registration attempts');
    return true;
  } else {
    console.log('\n❌ FAIL: Rate limit did not trigger after 6 attempts');
    return false;
  }
}

async function runTests() {
  console.log('\nStarting rate limit tests...');
  console.log('NOTE: These tests require the server to be running on port 3001\n');

  // Wait a moment for server to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));

  const results = [];

  // Test login rate limiting
  try {
    const loginResult = await testLoginRateLimit();
    results.push({ test: 'Login Rate Limiting', passed: loginResult });
  } catch (error) {
    console.error('Login test error:', error);
    results.push({ test: 'Login Rate Limiting', passed: false });
  }

  // Wait between tests to avoid overlapping rate limits
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test registration rate limiting
  try {
    const registerResult = await testRegisterRateLimit();
    results.push({ test: 'Registration Rate Limiting', passed: registerResult });
  } catch (error) {
    console.error('Registration test error:', error);
    results.push({ test: 'Registration Rate Limiting', passed: false });
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('Test Summary');
  console.log('='.repeat(70));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${result.test}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(70));

  if (failed === 0) {
    console.log('\n✅ ALL TESTS PASSED - Rate limiting working correctly!\n');
    process.exit(0);
  } else {
    console.log('\n❌ SOME TESTS FAILED - Review rate limiting configuration\n');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Test execution error:', error);
  process.exit(1);
});

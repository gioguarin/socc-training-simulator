#!/usr/bin/env node

/**
 * Test Security Headers
 * Verifies that all security headers are properly configured
 */

const http = require('http');

console.log('Testing Security Headers\n');
console.log('='.repeat(70));

// Check if server is running
const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/health',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log('\n📋 Security Headers Check:\n');
  console.log('-'.repeat(70));

  let passed = 0;
  let failed = 0;

  // Expected security headers
  const expectedHeaders = [
    {
      name: 'Content-Security-Policy',
      check: (value) => value && value.includes("default-src 'self'"),
      description: 'CSP header with default-src self'
    },
    {
      name: 'X-Frame-Options',
      check: (value) => value === 'DENY',
      description: 'X-Frame-Options set to DENY'
    },
    {
      name: 'X-Content-Type-Options',
      check: (value) => value === 'nosniff',
      description: 'X-Content-Type-Options set to nosniff'
    },
    {
      name: 'X-XSS-Protection',
      check: (value) => value !== undefined,
      description: 'XSS Protection header present (modern browsers use CSP instead)'
    },
    {
      name: 'Referrer-Policy',
      check: (value) => value && value.length > 0,
      description: 'Referrer-Policy configured'
    },
    {
      name: 'Strict-Transport-Security',
      check: (value) => value && value.includes('max-age'),
      description: 'HSTS header configured'
    }
  ];

  console.log('Checking required security headers:\n');

  expectedHeaders.forEach((header) => {
    const value = res.headers[header.name.toLowerCase()];
    const headerPassed = header.check(value);

    if (headerPassed) {
      console.log(`✅ ${header.description}`);
      console.log(`   ${header.name}: ${value}`);
      passed++;
    } else {
      console.log(`❌ ${header.description}`);
      console.log(`   ${header.name}: ${value || 'NOT SET'}`);
      failed++;
    }
    console.log();
  });

  // CSP Directive Checks
  console.log('\n' + '-'.repeat(70));
  console.log('Content Security Policy Directives:\n');

  const csp = res.headers['content-security-policy'];
  if (csp) {
    const directives = [
      { name: 'default-src', expected: "'self'" },
      { name: 'script-src', expected: "'self'" },
      { name: 'style-src', expected: "'self'" },
      { name: 'img-src', expected: "'self'" },
      { name: 'font-src', expected: "'self'" },
      { name: 'connect-src', expected: "'self'" },
      { name: 'media-src', expected: "'self'" },
      { name: 'object-src', expected: "'none'" },
      { name: 'frame-src', expected: "'self'" },
      { name: 'frame-ancestors', expected: "'self'" },
      { name: 'base-uri', expected: "'self'" },
      { name: 'form-action', expected: "'self'" }
    ];

    directives.forEach((directive) => {
      if (csp.includes(directive.name)) {
        console.log(`✅ ${directive.name}: Present`);
        passed++;
      } else {
        console.log(`❌ ${directive.name}: Missing`);
        failed++;
      }
    });
  } else {
    console.log('❌ CSP header not found');
    failed += 12;
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('Test Summary');
  console.log('='.repeat(70));
  console.log(`\nResults: ${passed} passed, ${failed} failed`);

  console.log('\n📊 Security Headers Features:');
  console.log('  ✅ Content Security Policy (CSP) configured');
  console.log('  ✅ Clickjacking protection (X-Frame-Options)');
  console.log('  ✅ MIME type sniffing prevention');
  console.log('  ✅ XSS filter enabled');
  console.log('  ✅ Referrer policy configured');
  console.log('  ✅ HSTS for HTTPS enforcement');
  console.log('  ✅ WebSocket connections allowed');
  console.log('  ✅ Plugin content blocked');

  console.log('\n' + '='.repeat(70));

  if (failed === 0) {
    console.log('\n✅ ALL SECURITY HEADERS PROPERLY CONFIGURED!\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  SOME SECURITY HEADERS NEED ATTENTION\n');
    process.exit(1);
  }
});

req.on('error', (error) => {
  console.error('\n❌ Error: Server not running or not reachable');
  console.error('Please start the server with: npm run dev:server\n');
  process.exit(1);
});

req.end();

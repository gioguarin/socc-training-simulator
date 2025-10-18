# Security Review Checklist for SOCC Training Simulator

This document provides a reusable security review checklist and procedures for conducting regular security audits of the SOCC Training Simulator codebase.

## Overview

This checklist should be used:
- Before each production deployment
- After adding new features
- Monthly as part of routine security maintenance
- After any security incident
- When updating major dependencies

## Quick Security Scan

Run these automated checks first:

```bash
# Check for known vulnerabilities in dependencies
npm audit
cd client && npm audit && cd ..

# Run linting with security rules
npm run lint

# Check for hardcoded secrets
git secrets --scan

# Check for common security issues
npx eslint-plugin-security .
```

---

## Authentication & Authorization Checklist

### JWT Token Security

- [ ] `JWT_SECRET` is at least 32 characters and set via environment variables
- [ ] No fallback/default values for `JWT_SECRET` in code
- [ ] JWT expiration time is reasonable (24h or less)
- [ ] JWT payload contains minimal data (user ID only preferred)
- [ ] JWT verification uses proper library methods (`jwt.verify`)
- [ ] Invalid tokens return appropriate error codes (401/403)

**Files to Check:**
- `server/middleware/auth.js`
- `server/routes/auth.js`

**Test Command:**
```bash
# Verify JWT secret is required
unset JWT_SECRET && node server/index.js
# Should fail to start
```

---

### Password Security

- [ ] Passwords hashed with bcrypt (or argon2)
- [ ] Salt rounds ≥ 12 for bcrypt
- [ ] Password minimum length enforced (≥ 8 characters)
- [ ] Passwords never logged or exposed in errors
- [ ] No password in URL parameters
- [ ] Account lockout after failed attempts (recommended)

**Files to Check:**
- `server/routes/auth.js` (registration/login)
- `server/models/User.js`

**Test:**
```javascript
// Test password hashing
const bcrypt = require('bcryptjs');
const hash = await bcrypt.hash('test', 12);
console.log('Hash length:', hash.length); // Should be 60
```

---

### Session Management

- [ ] `SESSION_SECRET` is strong and set via environment variables
- [ ] Sessions stored securely (SQLite with proper permissions)
- [ ] Session cookies have `httpOnly: true`
- [ ] Session cookies have `secure: true` in production
- [ ] Session cookies have `sameSite: 'strict'` or 'lax'
- [ ] Sessions expire after reasonable timeout
- [ ] Logout properly destroys sessions

**Files to Check:**
- `server/index.js` (session configuration)
- `server/routes/auth.js` (logout)

---

### Invite Code Security

- [ ] Invite codes generated with `crypto.randomBytes()` not `Math.random()`
- [ ] Invite codes are 10+ characters
- [ ] Codes validated for expiration
- [ ] Codes marked as used after registration
- [ ] No hardcoded invite codes in migrations or config
- [ ] Admin invite codes printed once at startup, not stored

**Files to Check:**
- `server/models/InviteCode.js` (`generate()` method)
- `server/database/migrations/001_add_invite_codes.sql`

**Test:**
```javascript
// Verify randomness
const codes = new Set();
for (let i = 0; i < 1000; i++) {
    codes.add(InviteCode.generate());
}
console.log('Unique codes:', codes.size); // Should be 1000
```

---

### OAuth Security

- [ ] OAuth credentials not hardcoded
- [ ] OAuth callback validates state parameter
- [ ] OAuth tokens not exposed in URLs
- [ ] OAuth profile data validated before use
- [ ] Proper error handling for OAuth failures

**Files to Check:**
- `server/routes/auth.js` (OAuth configuration)
- `server/middleware/auth.js` (`handleOAuthCallback`)

---

### Socket.io Authentication

- [ ] Socket connections require valid JWT token
- [ ] Tokens verified using `jwt.verify()` not mock users
- [ ] User data fetched from database, not hardcoded
- [ ] Disconnections properly cleaned up
- [ ] Game sessions validate user participation
- [ ] Chat messages attributed to correct user

**Files to Check:**
- `server/index.js` (io.use middleware, lines 202-224)

**Critical Test:**
```javascript
// Verify Socket.io auth rejects invalid tokens
io.connect('http://localhost:3001', {
    auth: { token: 'invalid-token' }
});
// Should fail to connect
```

---

## Input Validation & Injection Prevention

### SQL Injection Prevention

- [ ] All database queries use parameterized statements
- [ ] No string concatenation in SQL queries
- [ ] User input never directly interpolated into SQL
- [ ] Foreign keys enabled (`PRAGMA foreign_keys = ON`)

**Files to Check:**
- `server/models/*.js` (all model files)
- `server/database/init.js`

**Pattern to Find:**
```javascript
// ❌ BAD (SQL Injection vulnerable)
db.run(`SELECT * FROM users WHERE email = '${email}'`);

// ✅ GOOD (Parameterized)
db.run('SELECT * FROM users WHERE email = ?', [email]);
```

---

### Input Validation

- [ ] All user inputs validated for type
- [ ] String inputs have max length limits
- [ ] Numeric inputs validated for range
- [ ] Arrays validated for max length
- [ ] Email addresses validated for format
- [ ] File uploads restricted (if applicable)
- [ ] Special characters handled safely

**Files to Check:**
- `server/routes/auth.js` (registration/login)
- `server/routes/scenarios.js` (scenario submission)
- `server/routes/admin.js` (admin operations)
- `server/index.js` (Socket.io message handlers)

**Validation Template:**
```javascript
// Always validate before using user input
if (!input || typeof input !== 'string' || input.length > MAX_LENGTH) {
    return res.status(400).json({ error: 'Invalid input' });
}
const sanitized = input.trim().substring(0, MAX_LENGTH);
```

---

### XSS Prevention

- [ ] User input sanitized before storage
- [ ] Output encoding in frontend (React does this by default)
- [ ] No `dangerouslySetInnerHTML` without sanitization
- [ ] CSP headers configured properly
- [ ] Chat messages length-limited and trimmed

**Files to Check:**
- `server/index.js` (CSP configuration, chat handlers)
- `client/src/components/**/*.tsx`

---

## API & Network Security

### CORS Configuration

- [ ] CORS origin restricted to known frontend URLs
- [ ] Wildcard (*) not used in production
- [ ] Credentials allowed only for trusted origins
- [ ] Preflight requests handled correctly

**Files to Check:**
- `server/index.js` (CORS configuration)

**Test:**
```bash
# Test CORS headers
curl -H "Origin: http://evil.com" http://localhost:3001/api/health
# Should reject or not include CORS headers
```

---

### Rate Limiting

- [ ] Rate limiting enabled on all API routes
- [ ] Stricter limits on authentication endpoints (5-10 attempts/15min)
- [ ] Registration rate limited (3 attempts/hour)
- [ ] Password reset rate limited (if implemented)
- [ ] Admin operations have separate rate limits
- [ ] Rate limits configured per environment

**Files to Check:**
- `server/index.js` (rate limit configuration)

**Recommended Rates:**
```javascript
// Authentication: 5 attempts per 15 minutes
// Registration: 3 attempts per hour
// General API: 100 requests per 15 minutes
// Admin API: 50 requests per 15 minutes
```

---

### HTTPS & Transport Security

- [ ] HTTPS enforced in production
- [ ] HSTS header configured (max-age=31536000)
- [ ] Secure cookies only over HTTPS
- [ ] Certificate properly configured
- [ ] TLS 1.2+ required

**Files to Check:**
- `server/index.js` (Helmet HSTS configuration)
- Production deployment configuration

---

### Security Headers

- [ ] `Content-Security-Policy` configured
- [ ] `X-Frame-Options: DENY` or `SAMEORIGIN`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-XSS-Protection: 1; mode=block`
- [ ] `Referrer-Policy` set appropriately
- [ ] `Permissions-Policy` restricts features

**Files to Check:**
- `server/index.js` (Helmet configuration)

**Test:**
```bash
# Check security headers
curl -I http://localhost:3001/api/health
```

---

## Data Protection

### Sensitive Data Handling

- [ ] Passwords never logged
- [ ] JWT secrets not logged or exposed
- [ ] Session secrets not logged or exposed
- [ ] User emails protected in logs
- [ ] Database connection strings not exposed
- [ ] API keys/secrets in environment variables only
- [ ] `.env` file in `.gitignore`

**Files to Check:**
- `.gitignore`
- `server/index.js` (logging configuration)
- All console.log statements

**Audit Command:**
```bash
# Search for potential secret leaks
git log -p | grep -i "password\|secret\|key" | grep -v "placeholder"
```

---

### Database Security

- [ ] Database file has proper permissions (600)
- [ ] Database backups automated and encrypted
- [ ] Foreign keys enabled and enforced
- [ ] Database not publicly accessible
- [ ] Connection pooling configured properly

**Files to Check:**
- `server/database/init.js`
- Database file permissions: `ls -l data/socc-training.db`

---

### Encryption

- [ ] Passwords encrypted at rest (bcrypt)
- [ ] Tokens use cryptographically secure generation
- [ ] HTTPS encrypts data in transit
- [ ] Database encryption considered for sensitive data

---

## Error Handling & Logging

### Error Messages

- [ ] Error messages don't expose stack traces in production
- [ ] Error messages don't reveal system internals
- [ ] Generic error messages for authentication failures
- [ ] Detailed errors logged server-side only
- [ ] Request IDs included for debugging

**Files to Check:**
- `server/index.js` (error handling middleware)
- All route handlers

**Pattern:**
```javascript
// ✅ GOOD
res.status(500).json({
    error: "Internal server error",
    requestId: req.id
});
logger.error('Detailed error', { error: err.message, stack: err.stack });

// ❌ BAD
res.status(500).json({
    error: err.message,
    stack: err.stack
});
```

---

### Logging

- [ ] Winston properly configured
- [ ] Logs don't contain sensitive data
- [ ] Security events logged (failed logins, permission errors)
- [ ] Log rotation configured
- [ ] Logs monitored for security events
- [ ] Audit log complete and tamper-evident

**Files to Check:**
- `server/index.js` (Winston configuration)
- `logs/` directory

---

## Access Control

### Role-Based Access Control

- [ ] Three roles properly defined (admin, trainer, trainee)
- [ ] Role hierarchy enforced (admin > trainer > trainee)
- [ ] Middleware protects all admin routes
- [ ] Middleware protects all trainer routes
- [ ] Users can't escalate their own privileges
- [ ] Role changes logged in audit log

**Files to Check:**
- `server/middleware/auth.js` (`requireRole` function)
- `server/routes/admin.js`
- `server/routes/scenarios.js`

**Test:**
```bash
# Test unauthorized access
curl -H "Authorization: Bearer <trainee-token>" \
     http://localhost:3001/api/admin/users
# Should return 403 Forbidden
```

---

## Dependency Security

### npm Packages

- [ ] `npm audit` shows no critical/high vulnerabilities
- [ ] Dependencies updated regularly
- [ ] No known vulnerable versions in use
- [ ] Package-lock.json committed
- [ ] Minimal dependencies (avoid bloat)

**Commands:**
```bash
# Check for vulnerabilities
npm audit
npm audit fix

# Update dependencies safely
npm outdated
npm update

# Check for specific package issues
npm audit --json | jq '.vulnerabilities'
```

---

## Client-Side Security

### Token Storage

- [ ] Tokens not stored in localStorage (XSS vulnerable)
- [ ] Prefer httpOnly cookies for tokens
- [ ] sessionStorage if localStorage must be used
- [ ] Tokens cleared on logout

**Files to Check:**
- `client/src/contexts/AuthContext.tsx`

---

### API Communication

- [ ] API calls use HTTPS in production
- [ ] Credentials included correctly
- [ ] Errors handled gracefully
- [ ] Timeouts configured

**Files to Check:**
- `client/src/contexts/AuthContext.tsx`
- Any axios configuration

---

## Testing

### Security Test Suite

Create and run security-specific tests:

```bash
# Authentication tests
npm run test -- auth-security.test.js

# Input validation tests
npm run test -- input-validation.test.js

# Authorization tests
npm run test -- authorization.test.js

# Socket.io security tests
npm run test -- socket-security.test.js
```

### Manual Testing Checklist

- [ ] Attempt SQL injection in login form
- [ ] Attempt XSS in scenario submission
- [ ] Try accessing admin routes as trainee
- [ ] Test password reset flow (if implemented)
- [ ] Verify session expiration
- [ ] Test CORS with unauthorized origin
- [ ] Attempt brute force login
- [ ] Test invite code expiration
- [ ] Verify Socket.io authentication
- [ ] Test chat message length limits

---

## Pre-Deployment Checklist

Run before every production deployment:

### Configuration
- [ ] All environment variables set correctly
- [ ] No default/placeholder secrets in use
- [ ] Database connection secure
- [ ] HTTPS certificates valid
- [ ] Firewall rules configured

### Code Review
- [ ] Security review of all changed files
- [ ] No console.log with sensitive data
- [ ] No commented-out security features
- [ ] All TODOs addressed
- [ ] No debug code in production

### Testing
- [ ] All security tests passing
- [ ] Manual security testing complete
- [ ] Penetration testing performed (for major releases)
- [ ] Load testing with rate limits

### Monitoring
- [ ] Logging configured and working
- [ ] Error monitoring active
- [ ] Security event alerts configured
- [ ] Backup system tested

---

## Incident Response

If a security issue is discovered:

1. **Immediate Actions:**
   - Document the issue
   - Assess severity and impact
   - Contain the issue (disable feature if needed)

2. **Investigation:**
   - Review audit logs
   - Identify affected users/data
   - Determine root cause

3. **Remediation:**
   - Apply fix
   - Deploy patch
   - Verify fix effective

4. **Communication:**
   - Notify affected users (if applicable)
   - Update security documentation
   - Post-mortem analysis

5. **Prevention:**
   - Add to this checklist
   - Implement automated detection
   - Update testing procedures

---

## Regular Maintenance Schedule

### Weekly
- [ ] Review failed login attempts
- [ ] Check error logs for anomalies
- [ ] Verify backup systems working

### Monthly
- [ ] Run full security audit using this checklist
- [ ] Update dependencies (`npm audit`, `npm update`)
- [ ] Review and rotate logs
- [ ] Test disaster recovery procedures

### Quarterly
- [ ] Security training for developers
- [ ] Third-party security assessment
- [ ] Update security documentation
- [ ] Review and update policies

---

## Security Contacts

**Internal Security Team:**
- Email: security@company.com
- Slack: #security-incidents

**External Resources:**
- OWASP: https://owasp.org/
- Node.js Security WG: https://nodejs.org/en/security/
- npm Security: https://docs.npmjs.com/reporting-a-vulnerability-in-an-npm-package

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-10-18 | Initial security checklist created |

---

**Note:** This checklist should be updated whenever:
- New vulnerabilities are discovered
- New features are added
- Security best practices change
- After security incidents

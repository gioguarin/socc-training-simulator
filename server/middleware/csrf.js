/**
 * CSRF Protection Middleware
 * Protects against Cross-Site Request Forgery attacks
 */

const crypto = require('crypto');

/**
 * Generate a CSRF token
 */
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware to generate and attach CSRF token to session
 */
function csrfTokenGenerator(req, res, next) {
  if (!req.session) {
    return next(new Error('Session is required for CSRF protection'));
  }

  // Generate token if not exists
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }

  // Make token available to response
  res.locals.csrfToken = req.session.csrfToken;

  next();
}

/**
 * Middleware to validate CSRF token
 * Checks token from header or body
 */
function csrfProtection(req, res, next) {
  // Skip CSRF for safe methods (GET, HEAD, OPTIONS)
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Skip CSRF for API requests using JWT Bearer tokens
  // CSRF is primarily a concern for cookie-based auth
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  if (!req.session || !req.session.csrfToken) {
    return res.status(403).json({
      error: 'CSRF token missing from session'
    });
  }

  // Get token from header or body
  const token = req.headers['x-csrf-token'] ||
                req.headers['csrf-token'] ||
                req.body._csrf ||
                req.body.csrfToken;

  if (!token) {
    return res.status(403).json({
      error: 'CSRF token required',
      message: 'Include CSRF token in X-CSRF-Token header or request body'
    });
  }

  // Validate token using timing-safe comparison
  const sessionToken = req.session.csrfToken;
  const tokensMatch = crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(sessionToken)
  );

  if (!tokensMatch) {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'CSRF token validation failed'
    });
  }

  next();
}

/**
 * Route to get CSRF token for client
 */
function getCsrfToken(req, res) {
  if (!req.session || !req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }

  res.json({
    csrfToken: req.session.csrfToken
  });
}

/**
 * Documentation for CSRF protection
 */
const CSRF_DOCS = {
  description: 'CSRF protection for cookie-based operations',
  exemptions: [
    'GET, HEAD, OPTIONS requests (safe methods)',
    'Requests with Authorization: Bearer <JWT> header',
    'WebSocket connections (use JWT authentication)'
  ],
  usage: {
    client: [
      '1. GET /api/csrf-token to obtain token',
      '2. Include token in requests via:',
      '   - Header: X-CSRF-Token: <token>',
      '   - Body: { csrfToken: <token> } or { _csrf: <token> }'
    ],
    server: [
      'Apply csrfProtection middleware to routes that:',
      '- Use cookie-based authentication',
      '- Perform state-changing operations',
      '- Accept form submissions'
    ]
  },
  notes: [
    'JWT Bearer token requests are exempt (not vulnerable to CSRF)',
    'Tokens are stored in server-side session',
    'Uses timing-safe comparison to prevent timing attacks',
    'Tokens are regenerated per session'
  ]
};

module.exports = {
  generateCsrfToken,
  csrfTokenGenerator,
  csrfProtection,
  getCsrfToken,
  CSRF_DOCS
};

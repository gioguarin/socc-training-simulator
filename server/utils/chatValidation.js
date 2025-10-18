/**
 * Chat Message Validation Utilities
 * Prevents XSS, spam, and enforces message limits
 */

// Validation constants
const CHAT_LIMITS = {
  MIN_LENGTH: 1,
  MAX_LENGTH: 1000,
  MAX_MESSAGES_PER_MINUTE: 30,
  RATE_LIMIT_WINDOW: 60000 // 1 minute in milliseconds
};

// Track message rates per user
const userMessageRates = new Map();

/**
 * Sanitize chat message to prevent XSS
 */
function sanitizeMessage(message) {
  if (typeof message !== 'string') {
    return '';
  }

  // Remove null bytes
  let sanitized = message.replace(/\0/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Escape HTML special characters to prevent XSS
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  // Remove any remaining control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

  return sanitized;
}

/**
 * Validate message content and length
 */
function validateMessage(message) {
  const errors = [];

  if (!message) {
    errors.push('Message cannot be empty');
    return { valid: false, errors };
  }

  if (typeof message !== 'string') {
    errors.push('Message must be a string');
    return { valid: false, errors };
  }

  const trimmed = message.trim();

  if (trimmed.length < CHAT_LIMITS.MIN_LENGTH) {
    errors.push(`Message must be at least ${CHAT_LIMITS.MIN_LENGTH} character`);
  }

  if (trimmed.length > CHAT_LIMITS.MAX_LENGTH) {
    errors.push(`Message must not exceed ${CHAT_LIMITS.MAX_LENGTH} characters`);
  }

  // Check for repeated characters (potential spam)
  const repeatedCharsPattern = /(.)\1{50,}/;
  if (repeatedCharsPattern.test(trimmed)) {
    errors.push('Message contains excessive repeated characters');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check rate limiting for user messages
 */
function checkRateLimit(userId) {
  const now = Date.now();

  if (!userMessageRates.has(userId)) {
    userMessageRates.set(userId, {
      count: 1,
      windowStart: now
    });
    return { allowed: true, remaining: CHAT_LIMITS.MAX_MESSAGES_PER_MINUTE - 1 };
  }

  const userRate = userMessageRates.get(userId);
  const windowElapsed = now - userRate.windowStart;

  // Reset window if time has passed
  if (windowElapsed >= CHAT_LIMITS.RATE_LIMIT_WINDOW) {
    userMessageRates.set(userId, {
      count: 1,
      windowStart: now
    });
    return { allowed: true, remaining: CHAT_LIMITS.MAX_MESSAGES_PER_MINUTE - 1 };
  }

  // Check if limit exceeded
  if (userRate.count >= CHAT_LIMITS.MAX_MESSAGES_PER_MINUTE) {
    const resetIn = CHAT_LIMITS.RATE_LIMIT_WINDOW - windowElapsed;
    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.ceil(resetIn / 1000) // seconds
    };
  }

  // Increment count
  userRate.count++;
  return {
    allowed: true,
    remaining: CHAT_LIMITS.MAX_MESSAGES_PER_MINUTE - userRate.count
  };
}

/**
 * Complete validation and sanitization pipeline
 */
function processMessage(message, userId) {
  // Validate structure and length
  const validation = validateMessage(message);
  if (!validation.valid) {
    return {
      valid: false,
      errors: validation.errors
    };
  }

  // Check rate limiting
  const rateLimit = checkRateLimit(userId);
  if (!rateLimit.allowed) {
    return {
      valid: false,
      errors: [`Rate limit exceeded. Try again in ${rateLimit.resetIn} seconds`],
      rateLimitExceeded: true
    };
  }

  // Sanitize the message
  const sanitized = sanitizeMessage(message);

  return {
    valid: true,
    message: sanitized,
    metadata: {
      originalLength: message.length,
      sanitizedLength: sanitized.length,
      remaining: rateLimit.remaining
    }
  };
}

/**
 * Clean up old rate limit data (call periodically)
 */
function cleanupRateLimits() {
  const now = Date.now();
  for (const [userId, data] of userMessageRates.entries()) {
    if (now - data.windowStart >= CHAT_LIMITS.RATE_LIMIT_WINDOW) {
      userMessageRates.delete(userId);
    }
  }
}

// Clean up every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);

module.exports = {
  CHAT_LIMITS,
  sanitizeMessage,
  validateMessage,
  checkRateLimit,
  processMessage
};

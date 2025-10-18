/**
 * Email Validation Utilities
 * Comprehensive email format validation and sanitization
 */

// RFC 5322 compliant email regex (simplified but robust)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Common disposable email providers (to optionally block)
const DISPOSABLE_DOMAINS = [
  '10minutemail.com',
  'guerrillamail.com',
  'temp-mail.org',
  'throwaway.email',
  'mailinator.com',
  'yopmail.com'
];

// Maximum email length (RFC 5321)
const MAX_EMAIL_LENGTH = 254;
const MAX_LOCAL_PART_LENGTH = 64;
const MAX_DOMAIN_LENGTH = 253;

/**
 * Validate email format
 */
function validateEmailFormat(email) {
  const errors = [];

  if (!email || typeof email !== 'string') {
    errors.push('Email is required');
    return { valid: false, errors };
  }

  // Normalize email
  const normalized = email.trim().toLowerCase();

  // Check length
  if (normalized.length > MAX_EMAIL_LENGTH) {
    errors.push(`Email must not exceed ${MAX_EMAIL_LENGTH} characters`);
  }

  // Check format using regex
  if (!EMAIL_REGEX.test(normalized)) {
    errors.push('Invalid email format');
    return { valid: false, errors };
  }

  // Split into local and domain parts
  const [localPart, ...domainParts] = normalized.split('@');
  const domain = domainParts.join('@'); // Handle edge case of multiple @

  // Validate local part
  if (localPart.length === 0) {
    errors.push('Email local part cannot be empty');
  }

  if (localPart.length > MAX_LOCAL_PART_LENGTH) {
    errors.push(`Email local part must not exceed ${MAX_LOCAL_PART_LENGTH} characters`);
  }

  // Validate domain
  if (!domain || domain.length === 0) {
    errors.push('Email domain is required');
  }

  if (domain.length > MAX_DOMAIN_LENGTH) {
    errors.push(`Email domain must not exceed ${MAX_DOMAIN_LENGTH} characters`);
  }

  // Check for valid TLD (at least one dot in domain)
  if (domain && !domain.includes('.')) {
    errors.push('Email domain must include a top-level domain (e.g., .com, .org)');
  }

  // Check for invalid characters or patterns
  if (normalized.includes('..')) {
    errors.push('Email cannot contain consecutive dots');
  }

  if (normalized.startsWith('.') || normalized.endsWith('.')) {
    errors.push('Email cannot start or end with a dot');
  }

  if (normalized.includes('@.') || normalized.includes('.@')) {
    errors.push('Invalid dot placement around @ symbol');
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized: errors.length === 0 ? normalized : null
  };
}

/**
 * Check if email is from a disposable email provider
 */
function isDisposableEmail(email) {
  const normalized = email.trim().toLowerCase();
  const domain = normalized.split('@')[1];

  return DISPOSABLE_DOMAINS.includes(domain);
}

/**
 * Sanitize email (normalize and validate)
 */
function sanitizeEmail(email) {
  if (!email || typeof email !== 'string') {
    return null;
  }

  // Remove whitespace and convert to lowercase
  let sanitized = email.trim().toLowerCase();

  // Remove any null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Basic format check
  if (!EMAIL_REGEX.test(sanitized)) {
    return null;
  }

  return sanitized;
}

/**
 * Comprehensive email validation with all checks
 */
function validateEmail(email, options = {}) {
  const {
    allowDisposable = true,
    requireDomain = null,
    blockDomains = []
  } = options;

  // Format validation
  const formatResult = validateEmailFormat(email);
  if (!formatResult.valid) {
    return formatResult;
  }

  const normalized = formatResult.normalized;
  const domain = normalized.split('@')[1];
  const errors = [];

  // Check disposable email
  if (!allowDisposable && isDisposableEmail(normalized)) {
    errors.push('Disposable email addresses are not allowed');
  }

  // Check required domain
  if (requireDomain && !domain.endsWith(requireDomain)) {
    errors.push(`Email must be from ${requireDomain} domain`);
  }

  // Check blocked domains
  if (blockDomains.length > 0 && blockDomains.includes(domain)) {
    errors.push('Email domain is not allowed');
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized: errors.length === 0 ? normalized : null,
    domain,
    isDisposable: isDisposableEmail(normalized)
  };
}

/**
 * Validate multiple emails (e.g., for bulk invite codes)
 */
function validateEmails(emails, options = {}) {
  if (!Array.isArray(emails)) {
    return {
      valid: false,
      errors: ['Input must be an array of emails']
    };
  }

  const results = emails.map(email => validateEmail(email, options));
  const validEmails = results.filter(r => r.valid).map(r => r.normalized);
  const invalidEmails = results.filter(r => !r.valid);

  return {
    valid: invalidEmails.length === 0,
    validEmails,
    invalidEmails: invalidEmails.map((r, i) => ({
      email: emails[i],
      errors: r.errors
    })),
    count: {
      total: emails.length,
      valid: validEmails.length,
      invalid: invalidEmails.length
    }
  };
}

module.exports = {
  validateEmailFormat,
  isDisposableEmail,
  sanitizeEmail,
  validateEmail,
  validateEmails,
  EMAIL_REGEX,
  MAX_EMAIL_LENGTH,
  MAX_LOCAL_PART_LENGTH,
  MAX_DOMAIN_LENGTH,
  DISPOSABLE_DOMAINS
};

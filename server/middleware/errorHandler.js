/**
 * Error Sanitization Middleware
 * Prevents information leakage through error messages
 */

const winston = require('winston');

// Create error logger
const errorLogger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Add console logging in development
if (process.env.NODE_ENV !== 'production') {
  errorLogger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

/**
 * Sanitize error messages for production
 * Removes sensitive information from error responses
 */
function sanitizeError(error, req) {
  // Log full error details internally
  errorLogger.error('Application error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    user: req.user?.id || 'anonymous',
    timestamp: new Date().toISOString()
  });

  // Determine if we should show detailed errors
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Create sanitized error response
  const sanitized = {
    error: 'Internal server error',
    message: 'An error occurred while processing your request'
  };

  // In development, include more details
  if (isDevelopment) {
    sanitized.error = error.message;
    sanitized.stack = error.stack;
  }

  // Handle known error types with safe messages
  if (error.name === 'ValidationError') {
    sanitized.error = 'Validation failed';
    sanitized.message = isDevelopment ? error.message : 'Invalid input provided';
  } else if (error.name === 'UnauthorizedError' || error.message.includes('auth')) {
    sanitized.error = 'Authentication failed';
    sanitized.message = 'Invalid or expired credentials';
  } else if (error.name === 'ForbiddenError') {
    sanitized.error = 'Access denied';
    sanitized.message = 'You do not have permission to access this resource';
  } else if (error.name === 'NotFoundError') {
    sanitized.error = 'Resource not found';
    sanitized.message = 'The requested resource does not exist';
  } else if (error.code === 'SQLITE_CONSTRAINT') {
    sanitized.error = 'Database constraint violation';
    sanitized.message = isDevelopment ? error.message : 'Operation violates data constraints';
  } else if (error.code?.startsWith('SQLITE_')) {
    sanitized.error = 'Database error';
    sanitized.message = 'A database error occurred';
  }

  return sanitized;
}

/**
 * Error handling middleware
 * Must be registered after all routes
 */
function errorHandler(err, req, res, next) {
  // Default to 500 Internal Server Error
  const statusCode = err.statusCode || err.status || 500;

  // Sanitize the error
  const sanitizedError = sanitizeError(err, req);

  // Send response
  res.status(statusCode).json(sanitizedError);
}

/**
 * Create a safe error response
 * Use this in try-catch blocks instead of exposing raw errors
 */
function createSafeError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/**
 * Wrap async route handlers to catch errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  sanitizeError,
  createSafeError,
  asyncHandler
};

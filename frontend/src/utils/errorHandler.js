/**
 * Error Handler Utility
 * Sanitizes errors in production to prevent exposing sensitive information
 */

const IS_PRODUCTION = import.meta.env.PROD;

/**
 * Sanitize error for safe logging
 * Removes sensitive URLs and config data in production
 */
export const sanitizeError = (error) => {
  if (!IS_PRODUCTION) {
    return error; // In development, show everything
  }

  // Create a clean error object without sensitive data
  const sanitized = {
    message: error.message || 'Request failed',
    status: error.response?.status,
    statusText: error.response?.statusText,
  };

  // Only include error data, not config or URLs
  if (error.response?.data) {
    sanitized.data = error.response.data;
  }

  return sanitized;
};

/**
 * Safe console.error that filters sensitive information in production
 */
export const safeConsoleError = (...args) => {
  if (!IS_PRODUCTION) {
    console.error(...args);
    return;
  }

  // In production, filter out axios errors with URLs
  const shouldLog = !args.some(arg => {
    if (typeof arg === 'string') {
      return arg.includes('lightcode-backend') || arg.includes('.onrender.com');
    }
    if (arg?.config?.url || arg?.config?.baseURL) {
      return true; // Skip axios errors with config
    }
    return false;
  });

  if (shouldLog) {
    console.error(...args.map(arg => {
      if (arg?.response) {
        return sanitizeError(arg);
      }
      return arg;
    }));
  }
};

/**
 * Log error only in development
 */
export const devLog = (...args) => {
  if (!IS_PRODUCTION) {
    console.log(...args);
  }
};

/**
 * Log warning only in development
 */
export const devWarn = (...args) => {
  if (!IS_PRODUCTION) {
    console.warn(...args);
  }
};

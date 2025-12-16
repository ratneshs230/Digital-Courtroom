/**
 * Contextual Error Handler for NyayaSutra
 * Provides user-friendly error messages with recovery suggestions
 */

export interface ContextualError {
  code: string;
  message: string;
  userMessage: string;
  recoverySuggestions: string[];
  retryable: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, unknown>;
}

export type ErrorCategory =
  | 'api_error'
  | 'network_error'
  | 'storage_error'
  | 'file_error'
  | 'validation_error'
  | 'auth_error'
  | 'rate_limit'
  | 'quota_exceeded'
  | 'unknown';

// Error patterns and their contextual responses
const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  category: ErrorCategory;
  createError: (match: RegExpMatchArray, originalError: Error) => ContextualError;
}> = [
  // API Key errors
  {
    pattern: /api.?key|unauthorized|invalid.*key|401/i,
    category: 'auth_error',
    createError: () => ({
      code: 'AUTH_INVALID_KEY',
      message: 'Invalid or missing API key',
      userMessage: 'Your API key appears to be invalid or missing.',
      recoverySuggestions: [
        'Check that your Gemini API key is entered correctly in the sidebar',
        'Ensure your API key has not expired',
        'Generate a new API key from Google AI Studio',
        'Make sure there are no extra spaces in the key'
      ],
      retryable: false,
      severity: 'high'
    })
  },
  // Rate limiting
  {
    pattern: /rate.?limit|too.?many.?requests|429|quota/i,
    category: 'rate_limit',
    createError: () => ({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'API rate limit exceeded',
      userMessage: 'Too many requests. Please wait a moment before trying again.',
      recoverySuggestions: [
        'Wait 30-60 seconds before retrying',
        'Reduce the number of documents being processed at once',
        'Consider upgrading your API plan for higher limits',
        'Try processing documents one at a time'
      ],
      retryable: true,
      severity: 'medium'
    })
  },
  // Network errors
  {
    pattern: /network|fetch|connection|timeout|ECONNREFUSED|ETIMEDOUT/i,
    category: 'network_error',
    createError: () => ({
      code: 'NETWORK_ERROR',
      message: 'Network connection failed',
      userMessage: 'Unable to connect to the server. Please check your internet connection.',
      recoverySuggestions: [
        'Check your internet connection',
        'Try refreshing the page',
        'Disable any VPN or proxy that might be blocking the connection',
        'Wait a few moments and try again'
      ],
      retryable: true,
      severity: 'medium'
    })
  },
  // Storage errors
  {
    pattern: /indexeddb|storage|quota.*exceeded|localstorage/i,
    category: 'storage_error',
    createError: () => ({
      code: 'STORAGE_ERROR',
      message: 'Browser storage error',
      userMessage: 'Unable to save data. Your browser storage may be full.',
      recoverySuggestions: [
        'Clear some browser data or cache',
        'Delete old projects you no longer need',
        'Try using a different browser',
        'Check if private/incognito mode is blocking storage'
      ],
      retryable: false,
      severity: 'high'
    })
  },
  // File processing errors
  {
    pattern: /pdf|file.*corrupt|parse.*error|invalid.*file|unsupported.*format/i,
    category: 'file_error',
    createError: (match, originalError) => ({
      code: 'FILE_PROCESSING_ERROR',
      message: 'File processing failed',
      userMessage: 'Unable to process one or more files. The file may be corrupted or in an unsupported format.',
      recoverySuggestions: [
        'Try converting the file to a different format (e.g., PDF to text)',
        'Check if the file opens correctly in other applications',
        'Try a smaller or simpler version of the document',
        'Ensure the file is not password-protected'
      ],
      retryable: false,
      severity: 'medium',
      context: { originalMessage: originalError.message }
    })
  },
  // Content too large
  {
    pattern: /too.?large|content.*length|payload|size.*limit/i,
    category: 'validation_error',
    createError: () => ({
      code: 'CONTENT_TOO_LARGE',
      message: 'Content exceeds size limit',
      userMessage: 'The document is too large to process. Try splitting it into smaller parts.',
      recoverySuggestions: [
        'Split the document into smaller sections',
        'Remove unnecessary content from the document',
        'Try uploading only the relevant pages',
        'Compress images if the document contains them'
      ],
      retryable: false,
      severity: 'medium'
    })
  },
  // JSON parsing errors
  {
    pattern: /json|parse|syntax.*error|unexpected.*token/i,
    category: 'api_error',
    createError: () => ({
      code: 'PARSE_ERROR',
      message: 'Failed to parse API response',
      userMessage: 'Received an unexpected response from the server. Please try again.',
      recoverySuggestions: [
        'Try the operation again',
        'If the problem persists, try with a different document',
        'Clear browser cache and refresh the page',
        'Report this issue if it continues'
      ],
      retryable: true,
      severity: 'low'
    })
  },
  // Quota exceeded
  {
    pattern: /quota|billing|payment|subscription/i,
    category: 'quota_exceeded',
    createError: () => ({
      code: 'QUOTA_EXCEEDED',
      message: 'API quota exceeded',
      userMessage: 'You have reached your API usage limit for this period.',
      recoverySuggestions: [
        'Wait until your quota resets (usually daily or monthly)',
        'Upgrade your API plan for more usage',
        'Use a different API key if you have one',
        'Reduce the frequency of API calls'
      ],
      retryable: false,
      severity: 'high'
    })
  },
  // Model/service unavailable
  {
    pattern: /model.*not.*found|service.*unavailable|503|502|500/i,
    category: 'api_error',
    createError: () => ({
      code: 'SERVICE_UNAVAILABLE',
      message: 'AI service temporarily unavailable',
      userMessage: 'The AI service is temporarily unavailable. Please try again in a few minutes.',
      recoverySuggestions: [
        'Wait a few minutes and try again',
        'Check if there are any known service outages',
        'Try refreshing the page',
        'If the problem persists, try again later'
      ],
      retryable: true,
      severity: 'medium'
    })
  }
];

/**
 * Parse an error and return a contextual error object
 */
export function parseError(error: unknown): ContextualError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorString = errorMessage.toLowerCase();

  // Try to match error patterns
  for (const { pattern, createError } of ERROR_PATTERNS) {
    const match = errorString.match(pattern);
    if (match) {
      const originalError = error instanceof Error ? error : new Error(errorMessage);
      return createError(match, originalError);
    }
  }

  // Default unknown error
  return {
    code: 'UNKNOWN_ERROR',
    message: errorMessage,
    userMessage: 'An unexpected error occurred. Please try again.',
    recoverySuggestions: [
      'Refresh the page and try again',
      'Check your internet connection',
      'If the problem persists, please report this issue'
    ],
    retryable: true,
    severity: 'medium',
    context: { originalMessage: errorMessage }
  };
}

/**
 * Create a user-friendly error message with HTML formatting
 */
export function formatErrorForDisplay(error: ContextualError): {
  title: string;
  message: string;
  suggestions: string[];
  canRetry: boolean;
} {
  return {
    title: getErrorTitle(error.severity),
    message: error.userMessage,
    suggestions: error.recoverySuggestions,
    canRetry: error.retryable
  };
}

/**
 * Get error title based on severity
 */
function getErrorTitle(severity: ContextualError['severity']): string {
  switch (severity) {
    case 'critical':
      return 'Critical Error';
    case 'high':
      return 'Error';
    case 'medium':
      return 'Something went wrong';
    case 'low':
      return 'Minor Issue';
    default:
      return 'Error';
  }
}

/**
 * Log error with context for debugging
 */
export function logError(error: ContextualError, additionalContext?: Record<string, unknown>): void {
  const logData = {
    timestamp: new Date().toISOString(),
    code: error.code,
    message: error.message,
    severity: error.severity,
    retryable: error.retryable,
    context: { ...error.context, ...additionalContext }
  };

  if (error.severity === 'critical' || error.severity === 'high') {
    console.error('[NyayaSutra Error]', logData);
  } else {
    console.warn('[NyayaSutra Warning]', logData);
  }
}

/**
 * Create an error handler with automatic parsing and logging
 */
export function createErrorHandler(context: string) {
  return {
    handle: (error: unknown, additionalContext?: Record<string, unknown>): ContextualError => {
      const parsed = parseError(error);
      logError(parsed, { handlerContext: context, ...additionalContext });
      return parsed;
    },
    wrap: <T>(promise: Promise<T>, fallback?: T): Promise<T> => {
      return promise.catch((error) => {
        const parsed = parseError(error);
        logError(parsed, { handlerContext: context });
        if (fallback !== undefined) {
          return fallback;
        }
        throw parsed;
      });
    }
  };
}

/**
 * Type guard to check if an error is a ContextualError
 */
export function isContextualError(error: unknown): error is ContextualError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'userMessage' in error &&
    'recoverySuggestions' in error
  );
}

/**
 * Get recovery action based on error
 */
export function getRecoveryAction(error: ContextualError): {
  action: 'retry' | 'refresh' | 'reconfigure' | 'wait' | 'report';
  delay?: number;
  message: string;
} {
  switch (error.code) {
    case 'RATE_LIMIT_EXCEEDED':
      return { action: 'wait', delay: 30000, message: 'Wait 30 seconds, then retry' };
    case 'AUTH_INVALID_KEY':
      return { action: 'reconfigure', message: 'Check your API key settings' };
    case 'NETWORK_ERROR':
      return { action: 'retry', delay: 2000, message: 'Check connection and retry' };
    case 'SERVICE_UNAVAILABLE':
      return { action: 'wait', delay: 60000, message: 'Service down, try again in 1 minute' };
    case 'STORAGE_ERROR':
      return { action: 'refresh', message: 'Clear cache and refresh page' };
    case 'QUOTA_EXCEEDED':
      return { action: 'wait', delay: 3600000, message: 'Quota exceeded, wait for reset' };
    default:
      return error.retryable
        ? { action: 'retry', delay: 1000, message: 'Try again' }
        : { action: 'report', message: 'Report this issue' };
  }
}

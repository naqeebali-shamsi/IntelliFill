/**
 * Centralized error handling for Zustand stores
 */

import { AppError } from './types';

export class StoreError extends Error {
  public code: string;
  public details?: string;
  public severity: AppError['severity'];
  public component: string;
  public timestamp: number;

  constructor(
    message: string,
    code: string = 'STORE_ERROR',
    component: string = 'unknown',
    severity: AppError['severity'] = 'medium',
    details?: string
  ) {
    super(message);
    this.name = 'StoreError';
    this.code = code;
    this.details = details;
    this.severity = severity;
    this.component = component;
    this.timestamp = Date.now();
  }

  toAppError(context?: Record<string, any>): AppError {
    return {
      id: `${this.component}_${this.timestamp}`,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      severity: this.severity,
      component: this.component,
      context,
      resolved: false,
    };
  }
}

/**
 * Create standardized authentication errors
 */
export const createAuthError = (error: any): StoreError => {
  const status = error.response?.status;
  const serverCode = error.response?.data?.code;
  const serverMessage = error.response?.data?.message;

  // Map HTTP status codes to our error codes
  switch (status) {
    case 401:
      return new StoreError(
        serverMessage || 'Invalid email or password',
        serverCode || 'INVALID_CREDENTIALS',
        'auth',
        'medium',
        error.response?.data?.details
      );
    case 403:
      return new StoreError(
        'Access forbidden',
        'ACCESS_FORBIDDEN',
        'auth',
        'high'
      );
    case 423:
      return new StoreError(
        'Account is temporarily locked',
        'ACCOUNT_LOCKED',
        'auth',
        'high',
        'Too many failed login attempts'
      );
    case 429:
      return new StoreError(
        'Too many requests. Please try again later.',
        'RATE_LIMIT',
        'auth',
        'medium'
      );
    case 409:
      return new StoreError(
        'An account with this email already exists',
        'EMAIL_EXISTS',
        'auth',
        'low'
      );
    case 422:
      return new StoreError(
        serverMessage || 'Invalid data provided',
        'VALIDATION_ERROR',
        'auth',
        'low',
        error.response?.data?.details
      );
    case 500:
      return new StoreError(
        'Internal server error. Please try again later.',
        'SERVER_ERROR',
        'auth',
        'critical'
      );
    default:
      return new StoreError(
        error.message || 'An unexpected error occurred',
        error.code || 'UNKNOWN_ERROR',
        'auth',
        'medium',
        error.response?.data?.details
      );
  }
};

/**
 * Create standardized API errors
 */
export const createApiError = (error: any, component: string = 'api'): StoreError => {
  if (error.response) {
    // Server responded with error status
    const status = error.response.status;
    const message = error.response.data?.message || error.message;
    const code = error.response.data?.code || `HTTP_${status}`;
    const severity: AppError['severity'] = status >= 500 ? 'critical' : 
                                          status >= 400 ? 'medium' : 'low';
    
    return new StoreError(message, code, component, severity, error.response.data?.details);
  } else if (error.request) {
    // Network error
    return new StoreError(
      'Network error. Please check your connection.',
      'NETWORK_ERROR',
      component,
      'high'
    );
  } else {
    // Other error
    return new StoreError(
      error.message || 'An unexpected error occurred',
      'UNKNOWN_ERROR',
      component,
      'medium'
    );
  }
};

/**
 * Error recovery strategies
 */
export const getErrorRecoveryAction = (error: StoreError): string | null => {
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return 'Please check your email and password and try again';
    case 'ACCOUNT_LOCKED':
      return 'Wait for the lockout period to expire or contact support';
    case 'RATE_LIMIT':
      return 'Please wait a moment before trying again';
    case 'EMAIL_EXISTS':
      return 'Try logging in instead or use a different email address';
    case 'NETWORK_ERROR':
      return 'Please check your internet connection and try again';
    case 'SERVER_ERROR':
      return 'Please try again later or contact support if the problem persists';
    default:
      return null;
  }
};

/**
 * Check if an error is recoverable
 */
export const isRecoverableError = (error: StoreError): boolean => {
  const recoverableCodes = [
    'INVALID_CREDENTIALS',
    'RATE_LIMIT',
    'NETWORK_ERROR',
    'VALIDATION_ERROR'
  ];
  
  return recoverableCodes.includes(error.code);
};

/**
 * Format error for display to users
 */
export const formatErrorForDisplay = (error: StoreError): string => {
  const recoveryAction = getErrorRecoveryAction(error);
  return recoveryAction ? `${error.message}. ${recoveryAction}` : error.message;
};
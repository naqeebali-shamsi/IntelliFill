/**
 * Organization Context Error Definitions
 *
 * Centralized error constants and helper for consistent error responses
 * across organization context middleware.
 */

import { Response } from 'express';

interface OrgContextError {
  status: number;
  error: string;
  message: string;
  code: string;
}

export const ORG_CONTEXT_ERRORS = {
  AUTH_REQUIRED: {
    status: 401,
    error: 'Unauthorized',
    message: 'Authentication required',
    code: 'AUTH_REQUIRED',
  },
  MISSING_ORG_ID: {
    status: 400,
    error: 'Bad Request',
    message: 'Organization ID is required',
    code: 'MISSING_ORG_ID',
  },
  ORGANIZATION_REQUIRED: {
    status: 403,
    error: 'Forbidden',
    message: 'User must belong to an organization to access this resource',
    code: 'ORGANIZATION_REQUIRED',
  },
  NO_ORGANIZATION: {
    status: 403,
    error: 'Forbidden',
    message: 'User has no organization membership',
    code: 'NO_ORGANIZATION',
  },
  NOT_ORG_MEMBER: {
    status: 403,
    error: 'Forbidden',
    message: 'You are not a member of this organization',
    code: 'NOT_ORG_MEMBER',
  },
  ADMIN_REQUIRED: {
    status: 403,
    error: 'Forbidden',
    message: 'You must be an admin or owner to perform this action',
    code: 'ADMIN_REQUIRED',
  },
  OWNER_REQUIRED: {
    status: 403,
    error: 'Forbidden',
    message: 'You must be an owner to perform this action',
    code: 'OWNER_REQUIRED',
  },
  ORG_ACCESS_DENIED: {
    status: 403,
    error: 'Forbidden',
    message: 'Access denied to this organization',
    code: 'ORG_ACCESS_DENIED',
  },
  ORG_CONTEXT_ERROR: {
    status: 500,
    error: 'Internal Server Error',
    message: 'Failed to validate organization context',
    code: 'ORG_CONTEXT_ERROR',
  },
  ORG_ACCESS_ERROR: {
    status: 500,
    error: 'Internal Server Error',
    message: 'Failed to validate organization access',
    code: 'ORG_ACCESS_ERROR',
  },
  ORG_MEMBER_CHECK_ERROR: {
    status: 500,
    error: 'Internal Server Error',
    message: 'Failed to validate organization membership',
    code: 'ORG_MEMBER_CHECK_ERROR',
  },
  ORG_ADMIN_CHECK_ERROR: {
    status: 500,
    error: 'Internal Server Error',
    message: 'Failed to validate admin permissions',
    code: 'ORG_ADMIN_CHECK_ERROR',
  },
  ORG_OWNER_CHECK_ERROR: {
    status: 500,
    error: 'Internal Server Error',
    message: 'Failed to validate owner permissions',
    code: 'ORG_OWNER_CHECK_ERROR',
  },
} as const;

export type OrgContextErrorKey = keyof typeof ORG_CONTEXT_ERRORS;

/**
 * Send a standardized organization context error response
 */
export function sendOrgContextError(res: Response, errorKey: OrgContextErrorKey): void {
  const err: OrgContextError = ORG_CONTEXT_ERRORS[errorKey];
  res.status(err.status).json({
    error: err.error,
    message: err.message,
    code: err.code,
  });
}

/**
 * Create a custom error response with dynamic message
 */
export function sendCustomOrgError(
  res: Response,
  status: number,
  error: string,
  message: string,
  code: string
): void {
  res.status(status).json({ error, message, code });
}

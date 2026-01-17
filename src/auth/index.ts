/**
 * Authentication Module
 *
 * Provides authentication functionality for MCP servers
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayProxyResult,
} from 'aws-lambda';

export type LambdaEvent = APIGatewayProxyEvent | APIGatewayProxyEventV2;

export interface AuthUser {
  token?: string;
  [key: string]: unknown;
}

export interface AuthValidationResult {
  isValid: boolean;
  user?: AuthUser;
  token?: string;
  error?: APIGatewayProxyResult;
}

export interface BearerTokenAuthConfig {
  type: 'bearer-token';
  tokens?: string[];
  validate?: (
    token: string,
    event: LambdaEvent
  ) => AuthValidationResult | Promise<AuthValidationResult>;
}

export type AuthConfig = BearerTokenAuthConfig;

export {
  validateBearerToken,
  createBearerTokenConfigFromEnv,
  createBearerTokenConfigWithValidation,
} from './bearer-token.js';

export {
  createAuthMiddleware,
  createAuthenticatedHandler,
} from './middleware.js';

/**
 * Authentication configuration presets
 */
export const AuthPresets = {
  /**
   * Bearer token authentication using environment variable
   * @param {string} envVar - Environment variable name (default: 'VALID_TOKENS')
   * @returns {Object} Authentication configuration
   */
  bearerTokenFromEnv: (envVar = 'VALID_TOKENS'): BearerTokenAuthConfig => ({
    type: 'bearer-token',
    tokens: (process.env[envVar] || '').split(',').filter((t) => t.trim()),
  }),

  /**
   * Bearer token authentication with token list
   * @param {string[]} tokens - Array of valid tokens
   * @returns {Object} Authentication configuration
   */
  bearerTokenWithList: (tokens: string | string[]): BearerTokenAuthConfig => ({
    type: 'bearer-token',
    tokens: Array.isArray(tokens) ? tokens : [tokens],
  }),

  /**
   * Bearer token authentication with custom validation
   * @param {Function} validateFn - Custom validation function
   * @returns {Object} Authentication configuration
   */
  bearerTokenWithValidation: (
    validateFn: BearerTokenAuthConfig['validate']
  ): BearerTokenAuthConfig => ({
    type: 'bearer-token',
    validate: validateFn,
  }),
};

/**
 * Quick authentication setup helpers
 */
export const Auth = {
  /**
   * No authentication (default)
   */
  none: () => null,

  /**
   * Bearer token authentication from environment variable
   * @param {string} envVar - Environment variable name
   */
  bearerToken: (envVar = 'VALID_TOKENS'): BearerTokenAuthConfig =>
    AuthPresets.bearerTokenFromEnv(envVar),

  /**
   * Bearer token authentication with token list
   * @param {string|string[]} tokens - Token or array of tokens
   */
  bearerTokens: (tokens: string | string[]): BearerTokenAuthConfig =>
    AuthPresets.bearerTokenWithList(tokens),

  /**
   * Custom bearer token validation
   * @param {Function} validateFn - Validation function
   */
  custom: (
    validateFn: BearerTokenAuthConfig['validate']
  ): BearerTokenAuthConfig => AuthPresets.bearerTokenWithValidation(validateFn),
};

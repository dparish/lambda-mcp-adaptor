/**
 * Bearer Token Authentication Module
 *
 * Provides Bearer token validation functionality for MCP servers
 */
import type { AuthValidationResult, BearerTokenAuthConfig, LambdaEvent } from './index';
/**
 * Validates Bearer token from the Authorization header
 * @param {Object} event - Lambda event object
 * @param {Object} config - Authentication configuration
 * @returns {Object} Validation result with isValid flag and error/user data
 */
export declare function validateBearerToken(event: LambdaEvent, config?: BearerTokenAuthConfig): Promise<AuthValidationResult>;
/**
 * Creates a Bearer token authentication configuration from environment variables
 * @param {string} envVar - Environment variable name containing comma-separated tokens
 * @returns {Object} Authentication configuration
 */
export declare function createBearerTokenConfigFromEnv(envVar?: string): BearerTokenAuthConfig;
/**
 * Creates a Bearer token authentication configuration with custom validation
 * @param {Function} validateFn - Custom validation function
 * @returns {Object} Authentication configuration
 */
export declare function createBearerTokenConfigWithValidation(validateFn: BearerTokenAuthConfig['validate']): BearerTokenAuthConfig;

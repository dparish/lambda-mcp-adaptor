/**
 * Authentication Middleware Module
 *
 * Provides authentication middleware for MCP Lambda handlers
 */
import type { AuthConfig, LambdaEvent } from './index';
import type { APIGatewayProxyResult, Context } from 'aws-lambda';
/**
 * Creates an authentication middleware function
 * @param {Object} authConfig - Authentication configuration
 * @returns {Function} Middleware function
 */
export declare function createAuthMiddleware(authConfig: AuthConfig): (event: LambdaEvent) => Promise<APIGatewayProxyResult | null>;
/**
 * Creates an authenticated Lambda handler wrapper
 * @param {Function} originalHandler - Original Lambda handler function
 * @param {Object} authConfig - Authentication configuration
 * @returns {Function} Wrapped handler with authentication
 */
export declare function createAuthenticatedHandler(originalHandler: (event: LambdaEvent, context: Context) => Promise<APIGatewayProxyResult>, authConfig: AuthConfig): (event: LambdaEvent, context: Context) => Promise<APIGatewayProxyResult>;

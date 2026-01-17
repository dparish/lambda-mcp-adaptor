/**
 * Authentication Middleware Module
 *
 * Provides authentication middleware for MCP Lambda handlers
 */

import { validateBearerToken } from './bearer-token.js';
import { CORS_HEADERS, withBasicCORS } from '../cors-config.js';
import type {
  AuthConfig,
  AuthValidationResult,
  LambdaEvent,
} from './index.js';
import type { APIGatewayProxyResult, Context } from 'aws-lambda';

/**
 * Handles CORS preflight requests
 * @param {Object} event - Lambda event object
 * @returns {Object|null} CORS response or null if not a preflight request
 */
function handleCORSPreflight(
  event: LambdaEvent
): APIGatewayProxyResult | null {
  const method =
    'httpMethod' in event ? event.httpMethod : event.requestContext?.http?.method;

  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  return null;
}

/**
 * Creates an authentication middleware function
 * @param {Object} authConfig - Authentication configuration
 * @returns {Function} Middleware function
 */
export function createAuthMiddleware(authConfig: AuthConfig) {
  return async (event: LambdaEvent): Promise<APIGatewayProxyResult | null> => {
    // Handle CORS preflight requests
    const corsResponse = handleCORSPreflight(event);
    if (corsResponse) {
      return corsResponse;
    }

    // Perform authentication based on type
    let authResult: AuthValidationResult;

    switch (authConfig.type) {
      case 'bearer-token':
        authResult = await validateBearerToken(event, authConfig);
        break;

      default:
        console.error(`Unsupported authentication type: ${authConfig.type}`);
        return {
          statusCode: 500,
          headers: withBasicCORS({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            error: 'server_error',
            message: 'Unsupported authentication type',
          }),
        };
    }

    // Handle authentication failure
    if (!authResult.isValid) {
      console.log('Authentication failed:', authResult.error?.body);
      const fallbackError: APIGatewayProxyResult = {
        statusCode: 401,
        headers: withBasicCORS({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          error: 'unauthorized',
          message: 'Authentication failed',
        }),
      };
      return authResult.error ?? fallbackError;
    }

    // Authentication successful - add user context to event
    (event as LambdaEvent & { user?: AuthValidationResult['user'] }).user =
      authResult.user;
    (event as LambdaEvent & { authToken?: string }).authToken = authResult.token;

    console.log('Authentication successful');
    return null; // Continue to next middleware/handler
  };
}

/**
 * Creates an authenticated Lambda handler wrapper
 * @param {Function} originalHandler - Original Lambda handler function
 * @param {Object} authConfig - Authentication configuration
 * @returns {Function} Wrapped handler with authentication
 */
export function createAuthenticatedHandler(
  originalHandler: (
    event: LambdaEvent,
    context: Context
  ) => Promise<APIGatewayProxyResult>,
  authConfig: AuthConfig
): (event: LambdaEvent, context: Context) => Promise<APIGatewayProxyResult> {
  const authMiddleware = createAuthMiddleware(authConfig);

  return async (event: LambdaEvent, context: Context) => {
    console.log('=== MCP Server Request Start (with Authentication) ===');
    console.log('Event:', JSON.stringify(event, null, 2));

    try {
      // Run authentication middleware
      const authResponse = await authMiddleware(event);

      // If middleware returns a response, it means authentication failed or CORS preflight
      if (authResponse) {
        return authResponse;
      }

      // Authentication successful, proceed with original handler
      const response = await originalHandler(event, context);

      console.log('=== MCP Server Request End ===');
      return response;
    } catch (error) {
      console.error('Error in authenticated MCP server:', error);
      return {
        statusCode: 500,
        headers: withBasicCORS({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          error: 'internal_server_error',
          message: 'An internal server error occurred',
        }),
      };
    }
  };
}

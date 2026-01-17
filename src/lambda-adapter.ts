/**
 * AWS Lambda Adapter
 *
 * Handles Lambda integration and HTTP request/response processing
 */

import type {
  JSONRPCNotification,
  JSONRPCRequest,
} from './mcp-spec.js';
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import type { AuthConfig } from './auth/index.js';
import { CORS_HEADERS, withBasicCORS } from './cors-config.js';
import type { MCPServer } from './mcp-server.js';

type LambdaEvent = APIGatewayProxyEvent | APIGatewayProxyEventV2;
type LambdaHandler = (
  event: LambdaEvent,
  context: Context
) => Promise<APIGatewayProxyResult>;

export interface LambdaHandlerOptions {
  auth?: AuthConfig;
}

/**
 * Create HTTP response
 */
export function createResponse(
  body: unknown,
  statusCode: number = 200,
  headers: Record<string, string> = {}
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

/**
 * Create error response
 */
export function createErrorResponse(
  statusCode: number,
  code: number,
  message: string,
  headers: Record<string, string> = {},
  id: string | number | null = null
): APIGatewayProxyResult {
  return createResponse(
    {
      jsonrpc: '2.0',
      error: { code, message },
      id,
    },
    statusCode,
    headers
  );
}

/**
 * Handle MCP request processing
 */
export async function handleMCPRequest(
  mcpServer: MCPServer,
  body: string | null | undefined,
  headers: Record<string, string | undefined>,
  corsHeaders: Record<string, string>
): Promise<APIGatewayProxyResult> {
  const contentType = headers['content-type'] || headers['Content-Type'] || '';
  if (!contentType.includes('application/json')) {
    return createErrorResponse(
      400,
      -32700,
      'Parse error: Content-Type must be application/json',
      corsHeaders
    );
  }

  let jsonRpcMessage: JSONRPCRequest | JSONRPCNotification;
  try {
    jsonRpcMessage = JSON.parse(body || '{}') as JSONRPCRequest | JSONRPCNotification;
  } catch {
    return createErrorResponse(
      400,
      -32700,
      'Parse error: Invalid JSON',
      corsHeaders
    );
  }

  const responseId = 'id' in jsonRpcMessage ? jsonRpcMessage.id : null;

  if (!jsonRpcMessage.jsonrpc || jsonRpcMessage.jsonrpc !== '2.0') {
    return createErrorResponse(
      400,
      -32600,
      'Invalid Request: missing jsonrpc field',
      corsHeaders,
      responseId
    );
  }

  if (!jsonRpcMessage.method) {
    return createErrorResponse(
      400,
      -32600,
      'Invalid Request: missing method field',
      corsHeaders,
      responseId
    );
  }

  try {
    const result = await mcpServer.handleRequest(jsonRpcMessage);

    if (result === null) {
      return createResponse('', 204, corsHeaders);
    }

    return createResponse(
      {
        jsonrpc: '2.0',
        result,
        id: responseId,
      },
      200,
      corsHeaders
    );
  } catch (error) {
    console.error('MCP request error:', error);

    let errorCode = -32603; // Internal error
    let errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('Method not found')) {
      errorCode = -32601;
    } else if (errorMessage.includes('not found') || errorMessage.includes('required')) {
      errorCode = -32602; // Invalid params
    }

    return createErrorResponse(
      500,
      errorCode,
      errorMessage,
      corsHeaders,
      responseId
    );
  }
}

/**
 * AWS Lambda Adapter for MCP Server
 */
export function createLambdaHandler(
  mcpServer: MCPServer,
  options: LambdaHandlerOptions = {}
): LambdaHandler {
  const baseHandler: LambdaHandler = async (event) => {
    try {
      const method =
        'httpMethod' in event ? event.httpMethod : event.requestContext?.http?.method;
      const headers = event.headers || {};

      if (method === 'OPTIONS') {
        return createResponse('', 200, CORS_HEADERS);
      }

      if (method === 'POST') {
        return await handleMCPRequest(
          mcpServer,
          event.body,
          headers,
          CORS_HEADERS
        );
      }

      if (method === 'GET') {
        return createErrorResponse(
          405,
          -32000,
          'Method not allowed: Stateless mode',
          CORS_HEADERS
        );
      }

      return createErrorResponse(
        405,
        -32000,
        `Method not allowed: ${method}`,
        CORS_HEADERS
      );
    } catch (error) {
      console.error('Lambda error:', error);
      return createErrorResponse(
        500,
        -32603,
        'Internal server error',
        withBasicCORS({ 'Content-Type': 'application/json' })
      );
    }
  };

  // If authentication is configured, wrap with authentication middleware
  if (options.auth) {
    const authConfig = options.auth;
    return async (event: LambdaEvent, context: Context) => {
      try {
        const { createAuthenticatedHandler } = await import(
          './auth/middleware.js'
        );
        const authenticatedHandler = createAuthenticatedHandler(
          baseHandler,
          authConfig
        );
        return await authenticatedHandler(event, context);
      } catch (error) {
        console.error('Authentication module error:', error);
        return {
          statusCode: 500,
          headers: withBasicCORS({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            error: 'server_error',
            message: 'Authentication module not available',
          }),
        };
      }
    };
  }

  return baseHandler;
}

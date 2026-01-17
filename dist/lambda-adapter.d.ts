/**
 * AWS Lambda Adapter
 *
 * Handles Lambda integration and HTTP request/response processing
 */
import type { APIGatewayProxyEvent, APIGatewayProxyEventV2, APIGatewayProxyResult, Context } from 'aws-lambda';
import type { AuthConfig } from './auth/index';
import type { MCPServer } from './mcp-server';
type LambdaEvent = APIGatewayProxyEvent | APIGatewayProxyEventV2;
type LambdaHandler = (event: LambdaEvent, context: Context) => Promise<APIGatewayProxyResult>;
export interface LambdaHandlerOptions {
    auth?: AuthConfig;
}
/**
 * Create HTTP response
 */
export declare function createResponse(body: unknown, statusCode?: number, headers?: Record<string, string>): APIGatewayProxyResult;
/**
 * Create error response
 */
export declare function createErrorResponse(statusCode: number, code: number, message: string, headers?: Record<string, string>, id?: string | number | null): APIGatewayProxyResult;
/**
 * Handle MCP request processing
 */
export declare function handleMCPRequest(mcpServer: MCPServer, body: string | null | undefined, headers: Record<string, string | undefined>, corsHeaders: Record<string, string>): Promise<APIGatewayProxyResult>;
/**
 * AWS Lambda Adapter for MCP Server
 */
export declare function createLambdaHandler(mcpServer: MCPServer, options?: LambdaHandlerOptions): LambdaHandler;
export {};

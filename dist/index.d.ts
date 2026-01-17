/**
 * @aws-lambda-mcp/adapter
 *
 * An MCP (Model Context Protocol) server SDK for AWS Lambda
 * with Zod-based type safety, authentication support, and clean separation of concerns.
 */
import { MCPServer } from './mcp-server';
export { MCPServer } from './mcp-server';
export { createLambdaHandler } from './lambda-adapter';
export { CommonSchemas } from './common-schemas';
export declare function createMCPServer(config: ConstructorParameters<typeof MCPServer>[0]): MCPServer;

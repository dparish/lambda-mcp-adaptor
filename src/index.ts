/**
 * @aws-lambda-mcp/adapter
 *
 * An MCP (Model Context Protocol) server SDK for AWS Lambda
 * with Zod-based type safety, authentication support, and clean separation of concerns.
 */

// Core imports
import { MCPServer } from './mcp-server';

// Core exports
export { MCPServer } from './mcp-server';
export { createLambdaHandler } from './lambda-adapter';
export { CommonSchemas } from './common-schemas';

// Convenience function
export function createMCPServer(config: ConstructorParameters<typeof MCPServer>[0]) {
  return new MCPServer(config);
}

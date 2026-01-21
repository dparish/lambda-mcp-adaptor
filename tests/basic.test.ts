/**
 * Basic tests for lambda-mcp-adaptor
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createMCPServer, createLambdaHandler } from '../src';
import { z } from 'zod';
import type { MCPServer } from '../src';
import type { Context } from 'aws-lambda';
import type {
  BlobResourceContents,
  ContentBlock,
  TextContent,
  TextResourceContents,
} from '../src/mcp-spec';

type LambdaEvent = Parameters<ReturnType<typeof createLambdaHandler>>[0];

function asLambdaEvent(event: Partial<LambdaEvent>): LambdaEvent {
  return event as LambdaEvent;
}

function assertTextContent(block: ContentBlock): asserts block is TextContent {
  if (block.type !== 'text') {
    throw new Error(`Expected text content, got ${block.type}`);
  }
}

function assertTextResourceContents(
  content: TextResourceContents | BlobResourceContents
): asserts content is TextResourceContents {
  if (!('text' in content)) {
    throw new Error('Expected text resource contents');
  }
}

describe('lambda-mcp-adaptor', () => {
  let server: MCPServer;

  beforeEach(() => {
    server = createMCPServer({
      name: 'Test Server',
      version: '1.0.0',
      description: 'Test MCP Server'
    });
  });

  describe('MCPServer', () => {
    it('should create server with correct config', () => {
      expect(server.config.name).toBe('Test Server');
      expect(server.config.version).toBe('1.0.0');
      expect(server.config.protocolVersion).toBe('2025-03-26');
    });

    it('should register tools with method chaining', () => {
      const result = server
        .tool('test1', { input: z.string() }, async ({ input }) => ({ content: [{ type: 'text', text: input }] }))
        .tool('test2', { value: z.number() }, async ({ value }) => ({ content: [{ type: 'text', text: value.toString() }] }));

      expect(result).toBe(server);
      expect(server.tools.size).toBe(2);
      expect(server.tools.has('test1')).toBe(true);
      expect(server.tools.has('test2')).toBe(true);
    });

    it('should handle initialize request', async () => {
      server.tool('test', { input: z.string() }, async ({ input }) => ({ content: [{ type: 'text', text: input }] }));

      const result = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' }
        }
      });

      if (!result) {
        throw new Error('Unexpected error');
      }
      expect(result.protocolVersion).toBe('2025-03-26');
      expect(result.serverInfo.name).toBe('Test Server');
      expect(result.capabilities.tools).toEqual({ listChanged: true });
    });

    it('should handle tools/list request', async () => {
      server.tool('calculate', {
        a: z.number(),
        b: z.number()
      }, async ({ a, b }) => ({ content: [{ type: 'text', text: (a + b).toString() }] }));

      const result = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      });
      if (!result) {
        throw new Error('Unexpected error');
      }
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe('calculate');
      expect(result.tools[0].inputSchema.type).toBe('object');
      expect(result.tools[0].inputSchema.properties).toHaveProperty('a');
      expect(result.tools[0].inputSchema.properties).toHaveProperty('b');
    });

    it('should handle tools/call request with validation', async () => {
      server.tool('add', {
        a: z.number(),
        b: z.number()
      }, async ({ a, b }) => ({ content: [{ type: 'text', text: `${a} + ${b} = ${a + b}` }] }));

      const result = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'add',
          arguments: { a: 5, b: 3 }
        }
      });

      if (!result) {
        throw new Error('Unexpected error');
      }
      expect(Array.isArray(result.content)).toBe(true);
      assertTextContent(result.content[0]);
      expect(result.content[0].text).toBe('5 + 3 = 8');
    });

    it('should validate tool arguments with Zod', async () => {
      server.tool('validate_test', {
        email: z.string().email(),
        age: z.number().int().positive()
      }, async ({ email, age }) => ({ content: [{ type: 'text', text: `${email}: ${age}` }] }));

      // Valid arguments
      const validResult = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'validate_test',
          arguments: { email: 'test@example.com', age: 25 }
        }
      });

      if (!validResult) {
        throw new Error('Unexpected error');
      }
      assertTextContent(validResult.content[0]);
      expect(validResult.content[0].text).toBe('test@example.com: 25');

      // Invalid arguments should return error response
      const errorResult = await server.handleRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'validate_test',
          arguments: { email: 'invalid-email', age: -5 }
        }
      });

      if (!errorResult) {
        throw new Error('Unexpected error');
      }
      expect(errorResult.isError).toBe(true);
      assertTextContent(errorResult.content[0]);
      expect(errorResult.content[0].text).toContain('Validation error');
    });

    it('should handle optional parameters with defaults', async () => {
      server.tool('optional_test', {
        required: z.string(),
        optional: z.string().optional(),
        withDefault: z.number().optional().default(42)
      }, async ({ required, optional, withDefault }) => ({
        content: [{ type: 'text', text: `${required}, ${optional || 'none'}, ${withDefault}` }]
      }));

      const result = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'optional_test',
          arguments: { required: 'test' }
        }
      });

      if (!result) {
        throw new Error('Unexpected error');
      }

      assertTextContent(result.content[0]);
      expect(result.content[0].text).toBe('test, none, 42');
    });

    it('should handle enum validation', async () => {
      server.tool('enum_test', {
        operation: z.enum(['add', 'subtract', 'multiply'])
      }, async ({ operation }) => ({ content: [{ type: 'text', text: operation }] }));

      // Valid enum value
      const validResult = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'enum_test',
          arguments: { operation: 'add' }
        }
      });

      if (!validResult) {
        throw new Error('Unexpected error');
      }

      assertTextContent(validResult.content[0]);
      expect(validResult.content[0].text).toBe('add');

      // Invalid enum value should return error response
      const enumErrorResult = await server.handleRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'enum_test',
          arguments: { operation: 'invalid' }
        }
      });

      if(!enumErrorResult) {
        throw new Error('Unexpected error');
      }
      expect(enumErrorResult.isError).toBe(true);
      assertTextContent(enumErrorResult.content[0]);
      expect(enumErrorResult.content[0].text).toContain('Validation error');
    });

    it('should register and handle resources', async () => {
      server.resource('test-resource', 'test://resource', async (uri) => ({
        contents: [{ uri, text: 'Resource content', mimeType: 'text/plain' }]
      }));

      const listResult = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/list'
      });

      if(!listResult) throw new Error(
        'Unexpected error'
      )
      expect(listResult.resources).toHaveLength(1);
      expect(listResult.resources[0].name).toBe('test-resource');

      const readResult = await server.handleRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'resources/read',
        params: { uri: 'test://resource' }
      });

      if(!readResult) {
        throw new Error('Unexpected error');
      }
      assertTextResourceContents(readResult.contents[0]);
      expect(readResult.contents[0].text).toBe('Resource content');
    });

    it('should register and handle prompts', async () => {
      server.prompt('test-prompt', {
        input: z.string(),
        context: z.string().optional()
      }, ({ input, context }) => ({
        messages: [{
          role: 'user',
          content: { type: 'text', text: `Process: ${input}${context ? ` (${context})` : ''}` }
        }]
      }));

      const listResult = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'prompts/list'
      });

      if (!listResult) {
        throw new Error('Unexpected error');
      }

      expect(listResult.prompts).toHaveLength(1);
      expect(listResult.prompts[0].name).toBe('test-prompt');

      const getResult = await server.handleRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'prompts/get',
        params: {
          name: 'test-prompt',
          arguments: { input: 'test input', context: 'test context' }
        }
      });

      if (!getResult) {
        throw new Error('Unexpected error');
      }
      assertTextContent(getResult.messages[0].content);
      expect(getResult.messages[0].content.text).toBe('Process: test input (test context)');
    });
  });

  describe('Lambda Handler', () => {
    const context = {} as Context;

    it('should create Lambda handler', () => {
      const handler = createLambdaHandler(server);
      expect(handler).toBeTypeOf('function');
    });

    it('should handle OPTIONS request (CORS)', async () => {
      const handler = createLambdaHandler(server);

      const result = await handler(asLambdaEvent({
        httpMethod: 'OPTIONS',
        headers: {}
      }), context);

      expect(result.statusCode).toBe(200);
      const headers = result.headers ?? {};
      expect(headers['Access-Control-Allow-Origin']).toBe('*');
      expect(headers['Access-Control-Allow-Methods']).toContain('POST');
    });

    it('should handle POST request with MCP message', async () => {
      server.tool('test', { input: z.string() }, async ({ input }) => ({ content: [{ type: 'text', text: input }] }));

      const handler = createLambdaHandler(server);

      const result = await handler(asLambdaEvent({
        httpMethod: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        })
      }), context);

      expect(result.statusCode).toBe(200);
      const headers = result.headers ?? {};
      expect(headers['Content-Type']).toBe('application/json');

      const response = JSON.parse(result.body);
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(Array.isArray(response.result.tools)).toBe(true);
    });

    it('should handle invalid JSON', async () => {
      const handler = createLambdaHandler(server);

      const result = await handler(asLambdaEvent({
        httpMethod: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      }), context);

      expect(result.statusCode).toBe(400);

      const response = JSON.parse(result.body);
      expect(response.error.code).toBe(-32700);
      expect(response.error.message).toContain('Parse error');
    });

    it('should handle missing Content-Type', async () => {
      const handler = createLambdaHandler(server);

      const result = await handler(asLambdaEvent({
        httpMethod: 'POST',
        headers: {},
        body: '{}'
      }), context);

      expect(result.statusCode).toBe(400);

      const response = JSON.parse(result.body);
      expect(response.error.code).toBe(-32700);
      expect(response.error.message).toContain('Content-Type');
    });

    it('should handle GET request (not allowed)', async () => {
      const handler = createLambdaHandler(server);

      const result = await handler(asLambdaEvent({
        httpMethod: 'GET',
        headers: {}
      }), context);

      expect(result.statusCode).toBe(405);

      const response = JSON.parse(result.body);
      expect(response.error.code).toBe(-32000);
      expect(response.error.message).toContain('Method not allowed');
    });
  });
});

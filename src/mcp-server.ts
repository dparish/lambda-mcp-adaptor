/**
 * MCP Server Core Implementation
 *
 * Handles MCP protocol logic and tool/resource/prompt management
 */

import { z } from 'zod';
import type {
  CallToolRequestParams,
  CallToolResult,
  GetPromptRequestParams,
  GetPromptResult,
  InitializeResult,
  InitializeRequest,
  InitializedNotification,
  JSONRPCNotification,
  JSONRPCRequest,
  ListPromptsRequest,
  ListPromptsResult,
  ListResourcesRequest,
  ListResourcesResult,
  ListToolsRequest,
  ListToolsResult,
  PromptArgument,
  ReadResourceRequest,
  ReadResourceRequestParams,
  ReadResourceResult,
  Tool,
  CallToolRequest,
  GetPromptRequest,
} from './mcp-spec';
import {
  zodToJsonSchema,
  validateWithZod,
  isZodOptional,
} from './schema-utils';

export interface MCPServerConfig {
  name: string;
  version: string;
  description?: string;
  protocolVersion?: string;
}

type NormalizedMCPServerConfig = MCPServerConfig & {
  description: string;
  protocolVersion: string;
};

export type ZodSchema = z.ZodRawShape;
export type ToolHandler<T extends ZodSchema> = (
  args: z.infer<z.ZodObject<T>>
) => Promise<CallToolResult> | CallToolResult;
export type ResourceHandler = (
  uri: string
) => Promise<ReadResourceResult> | ReadResourceResult;
export type PromptHandler<T extends ZodSchema> = (
  args: z.infer<z.ZodObject<T>>
) => Promise<GetPromptResult> | GetPromptResult;

type ToolRegistration = {
  name: string;
  description: string;
  inputSchema: Tool['inputSchema'];
  handler: (args: Record<string, unknown>) => Promise<CallToolResult>;
};

type ResourceRegistration = {
  name: string;
  uri: string;
  description: string;
  handler: (uri: string) => Promise<ReadResourceResult>;
};

type PromptRegistration = {
  name: string;
  description: string;
  arguments: PromptArgument[];
  handler: (args: Record<string, unknown>) => Promise<GetPromptResult>;
};

type HandleRequestMethodMap = {
  initialize: InitializeResult;
  'notifications/initialized': null;
  'tools/list': ListToolsResult;
  'tools/call': CallToolResult;
  'resources/list': ListResourcesResult;
  'resources/read': ReadResourceResult;
  'prompts/list': ListPromptsResult;
  'prompts/get': GetPromptResult;
};

type HandleRequestResultUnion = HandleRequestMethodMap[keyof HandleRequestMethodMap];

/**
 * Main MCP Server class with Zod-based type safety
 */
export class MCPServer {
  config: NormalizedMCPServerConfig;
  tools: Map<string, ToolRegistration>;
  resources: Map<string, ResourceRegistration>;
  prompts: Map<string, PromptRegistration>;

  constructor(config: MCPServerConfig) {
    const {
      name = 'MCP Server',
      version = '1.0.0',
      description = 'MCP Server powered by AWS Lambda',
      protocolVersion = '2025-03-26',
      ...rest
    } = config;

    this.config = {
      name,
      version,
      description,
      protocolVersion,
      ...rest,
    };

    this.tools = new Map();
    this.resources = new Map();
    this.prompts = new Map();
  }

  /**
   * Register a tool with Zod schema validation
   */
  tool<T extends ZodSchema>(name: string, inputSchema: T, handler: ToolHandler<T>) {
    const jsonSchema = zodToJsonSchema(inputSchema);
    const handlerDescription = (handler as { description?: string }).description;

    const validatedHandler = async (args: Record<string, unknown>) => {
      try {
        const validatedArgs = validateWithZod(inputSchema, args);
        return await handler(validatedArgs);
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new Error(
            `Validation error: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
          );
        }
        throw error;
      }
    };

    this.tools.set(name, {
      name,
      description: handlerDescription || `Tool: ${name}`,
      inputSchema: jsonSchema as Tool['inputSchema'],
      handler: validatedHandler,
    });

    return this;
  }

  /**
   * Register a resource
   */
  resource(name: string, uri: string, handler: ResourceHandler) {
    const handlerDescription = (handler as { description?: string }).description;
    this.resources.set(name, {
      name,
      uri,
      description: handlerDescription || `Resource: ${name}`,
      handler: async (resourceUri: string) => handler(resourceUri),
    });

    return this;
  }

  /**
   * Register a prompt with Zod schema validation
   */
  prompt<T extends ZodSchema>(name: string, inputSchema: T, handler: PromptHandler<T>) {
    zodToJsonSchema(inputSchema);
    const handlerDescription = (handler as { description?: string }).description;

    const validatedHandler = async (args: Record<string, unknown>) => {
      try {
        const validatedArgs = validateWithZod(inputSchema, args);
        return await handler(validatedArgs);
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new Error(
            `Validation error: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
          );
        }
        throw error;
      }
    };

    this.prompts.set(name, {
      name,
      description: handlerDescription || `Prompt: ${name}`,
      arguments: Object.entries(inputSchema).map(([key, schema]) => ({
        name: key,
        description:
          (schema as z.ZodTypeAny).description || `${key} parameter`,
        required: !isZodOptional(schema as z.ZodTypeAny),
      })) as PromptArgument[],
      handler: validatedHandler,
    });

    return this;
  }

  /**
   * Handle MCP protocol requests
   */
  async handleRequest(request: InitializeRequest): Promise<InitializeResult>;
  async handleRequest(request: InitializedNotification): Promise<null>;
  async handleRequest(request: ListToolsRequest): Promise<ListToolsResult>;
  async handleRequest(request: CallToolRequest): Promise<CallToolResult>;
  async handleRequest(request: ListResourcesRequest): Promise<ListResourcesResult>;
  async handleRequest(request: ReadResourceRequest): Promise<ReadResourceResult>;
  async handleRequest(request: ListPromptsRequest): Promise<ListPromptsResult>;
  async handleRequest(request: GetPromptRequest): Promise<GetPromptResult>;
  async handleRequest(
    request: JSONRPCRequest | JSONRPCNotification
  ): Promise<HandleRequestResultUnion> {
    switch (request.method) {
      case 'initialize':
        return this.handleInitialize();
      case 'notifications/initialized':
        return null;
      case 'tools/list':
        return this.handleToolsList();
      case 'tools/call':
        return this.handleToolsCall(request.params as CallToolRequestParams);
      case 'resources/list':
        return this.handleResourcesList();
      case 'resources/read':
        return this.handleResourcesRead(request.params as ReadResourceRequestParams);
      case 'prompts/list':
        return this.handlePromptsList();
      case 'prompts/get':
        return this.handlePromptsGet(request.params as GetPromptRequestParams);
      default:
        throw new Error(`Method not found: ${request.method}`);
    }
  }

  /**
   * Handle initialize request
   */
  async handleInitialize(): Promise<InitializeResult> {
    return {
      protocolVersion: this.config.protocolVersion,
      capabilities: {
        tools: { listChanged: true },
        resources: { listChanged: true },
        prompts: { listChanged: true },
      },
      serverInfo: {
        name: this.config.name,
        version: this.config.version,
      },
      instructions: this.config.description,
    };
  }

  /**
   * Handle tools/list request
   */
  async handleToolsList(): Promise<ListToolsResult> {
    const tools = Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));

    return { tools };
  }

  /**
   * Handle tools/call request
   */
  async handleToolsCall(params: CallToolRequestParams): Promise<CallToolResult> {
    if (!params?.name) {
      throw new Error('Tool name is required');
    }

    const tool = this.tools.get(params.name);
    if (!tool) {
      throw new Error(`Tool not found: ${params.name}`);
    }

    try {
      const result = await tool.handler(params.arguments || {});
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        isError: true,
      };
    }
  }

  /**
   * Handle resources/list request
   */
  async handleResourcesList(): Promise<ListResourcesResult> {
    const resources = Array.from(this.resources.values()).map((resource) => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
    }));

    return { resources };
  }

  /**
   * Handle resources/read request
   */
  async handleResourcesRead(
    params: ReadResourceRequestParams
  ): Promise<ReadResourceResult> {
    if (!params?.uri) {
      throw new Error('Resource URI is required');
    }

    const resource = Array.from(this.resources.values()).find(
      (r) => r.uri === params.uri
    );
    if (!resource) {
      throw new Error(`Resource not found: ${params.uri}`);
    }

    try {
      const result = await resource.handler(params.uri);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Resource read error: ${errorMessage}`);
    }
  }

  /**
   * Handle prompts/list request
   */
  async handlePromptsList(): Promise<ListPromptsResult> {
    const prompts = Array.from(this.prompts.values()).map((prompt) => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments,
    }));

    return { prompts };
  }

  /**
   * Handle prompts/get request
   */
  async handlePromptsGet(
    params: GetPromptRequestParams
  ): Promise<GetPromptResult> {
    if (!params?.name) {
      throw new Error('Prompt name is required');
    }

    const prompt = this.prompts.get(params.name);
    if (!prompt) {
      throw new Error(`Prompt not found: ${params.name}`);
    }

    try {
      const result = await prompt.handler(params.arguments || {});
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Prompt execution error: ${errorMessage}`);
    }
  }

  /**
   * Get server statistics
   */
  getStats(): {
    tools: number;
    resources: number;
    prompts: number;
    config: MCPServerConfig;
  } {
    return {
      tools: this.tools.size,
      resources: this.resources.size,
      prompts: this.prompts.size,
      config: this.config,
    };
  }
}

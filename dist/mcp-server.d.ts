/**
 * MCP Server Core Implementation
 *
 * Handles MCP protocol logic and tool/resource/prompt management
 */
import { z } from 'zod';
import type { CallToolRequestParams, CallToolResult, GetPromptRequestParams, GetPromptResult, InitializeResult, JSONRPCNotification, JSONRPCRequest, ListPromptsResult, ListResourcesResult, ListToolsResult, PromptArgument, ReadResourceRequestParams, ReadResourceResult, Tool } from './mcp-spec';
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
export type ToolHandler<T extends ZodSchema> = (args: z.infer<z.ZodObject<T>>) => Promise<CallToolResult> | CallToolResult;
export type ResourceHandler = (uri: string) => Promise<ReadResourceResult> | ReadResourceResult;
export type PromptHandler<T extends ZodSchema> = (args: z.infer<z.ZodObject<T>>) => Promise<GetPromptResult> | GetPromptResult;
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
/**
 * Main MCP Server class with Zod-based type safety
 */
export declare class MCPServer {
    config: NormalizedMCPServerConfig;
    tools: Map<string, ToolRegistration>;
    resources: Map<string, ResourceRegistration>;
    prompts: Map<string, PromptRegistration>;
    constructor(config: MCPServerConfig);
    /**
     * Register a tool with Zod schema validation
     */
    tool<T extends ZodSchema>(name: string, inputSchema: T, handler: ToolHandler<T>): this;
    /**
     * Register a resource
     */
    resource(name: string, uri: string, handler: ResourceHandler): this;
    /**
     * Register a prompt with Zod schema validation
     */
    prompt<T extends ZodSchema>(name: string, inputSchema: T, handler: PromptHandler<T>): this;
    /**
     * Handle MCP protocol requests
     */
    handleRequest(request: JSONRPCRequest | JSONRPCNotification): Promise<InitializeResult | ListToolsResult | CallToolResult | ListResourcesResult | ReadResourceResult | ListPromptsResult | GetPromptResult | null>;
    /**
     * Handle initialize request
     */
    handleInitialize(): Promise<InitializeResult>;
    /**
     * Handle tools/list request
     */
    handleToolsList(): Promise<ListToolsResult>;
    /**
     * Handle tools/call request
     */
    handleToolsCall(params: CallToolRequestParams): Promise<CallToolResult>;
    /**
     * Handle resources/list request
     */
    handleResourcesList(): Promise<ListResourcesResult>;
    /**
     * Handle resources/read request
     */
    handleResourcesRead(params: ReadResourceRequestParams): Promise<ReadResourceResult>;
    /**
     * Handle prompts/list request
     */
    handlePromptsList(): Promise<ListPromptsResult>;
    /**
     * Handle prompts/get request
     */
    handlePromptsGet(params: GetPromptRequestParams): Promise<GetPromptResult>;
    /**
     * Get server statistics
     */
    getStats(): {
        tools: number;
        resources: number;
        prompts: number;
        config: MCPServerConfig;
    };
}
export {};

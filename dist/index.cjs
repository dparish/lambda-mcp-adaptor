const require_cors_config = require('./cors-config-HN36M-Ox.cjs');
let zod = require("zod");

//#region src/schema-utils.ts
/**
* Schema Utilities
*
* Zod schema conversion and validation utilities
*/
/**
* Convert Zod schema to JSON Schema
*/
function zodToJsonSchema(zodSchema) {
	const properties = {};
	const required = [];
	for (const [key, schema] of Object.entries(zodSchema)) {
		properties[key] = convertZodTypeToJsonSchema(schema);
		if (!isZodOptional(schema)) required.push(key);
	}
	return {
		type: "object",
		properties,
		required
	};
}
/**
* Convert individual Zod type to JSON Schema
*/
function convertZodTypeToJsonSchema(zodType) {
	if (zodType instanceof zod.z.ZodOptional) {
		const def = zodType._def;
		return convertZodTypeToJsonSchema(def.innerType);
	}
	if (zodType instanceof zod.z.ZodDefault) {
		const def = zodType._def;
		const schema = convertZodTypeToJsonSchema(def.innerType);
		schema.default = def.defaultValue();
		return schema;
	}
	if (zodType instanceof zod.z.ZodString) {
		const schema = { type: "string" };
		const def = zodType._def;
		if (def.checks) for (const check of def.checks) switch (check.kind) {
			case "min":
				schema.minLength = check.value;
				break;
			case "max":
				schema.maxLength = check.value;
				break;
			case "email":
				schema.format = "email";
				break;
			case "url":
				schema.format = "uri";
				break;
			case "uuid":
				schema.format = "uuid";
				break;
		}
		if (zodType.description) schema.description = zodType.description;
		return schema;
	}
	if (zodType instanceof zod.z.ZodNumber) {
		const schema = { type: "number" };
		const def = zodType._def;
		if (def.checks) for (const check of def.checks) switch (check.kind) {
			case "min":
				schema.minimum = check.value;
				break;
			case "max":
				schema.maximum = check.value;
				break;
			case "int":
				schema.type = "integer";
				break;
		}
		if (zodType.description) schema.description = zodType.description;
		return schema;
	}
	if (zodType instanceof zod.z.ZodBoolean) {
		const schema = { type: "boolean" };
		if (zodType.description) schema.description = zodType.description;
		return schema;
	}
	if (zodType instanceof zod.z.ZodEnum) {
		const schema = {
			type: "string",
			enum: zodType._def.values
		};
		if (zodType.description) schema.description = zodType.description;
		return schema;
	}
	if (zodType instanceof zod.z.ZodArray) {
		const schema = {
			type: "array",
			items: convertZodTypeToJsonSchema(zodType._def.type)
		};
		if (zodType._def.minLength) schema.minItems = zodType._def.minLength.value;
		if (zodType._def.maxLength) schema.maxItems = zodType._def.maxLength.value;
		if (zodType.description) schema.description = zodType.description;
		return schema;
	}
	if (zodType instanceof zod.z.ZodObject) return zodToJsonSchema(zodType.shape);
	return {
		type: "string",
		description: zodType.description || "Unknown type"
	};
}
/**
* Check if Zod type is optional
*/
function isZodOptional(zodType) {
	return zodType instanceof zod.z.ZodOptional || zodType instanceof zod.z.ZodDefault;
}
/**
* Check if Zod type has default value
*/
function hasZodDefault(zodType) {
	return zodType instanceof zod.z.ZodDefault;
}
/**
* Validate arguments with Zod schema
*/
function validateWithZod(zodSchema, args) {
	const validated = {};
	for (const [key, schema] of Object.entries(zodSchema)) try {
		if (args[key] === void 0 && isZodOptional(schema)) {
			if (hasZodDefault(schema)) validated[key] = schema.parse(void 0);
			continue;
		}
		validated[key] = schema.parse(args[key]);
	} catch (error) {
		throw new zod.z.ZodError([{
			code: "custom",
			path: [key],
			message: error instanceof Error ? error.message : String(error)
		}]);
	}
	return validated;
}

//#endregion
//#region src/mcp-server.ts
/**
* MCP Server Core Implementation
*
* Handles MCP protocol logic and tool/resource/prompt management
*/
/**
* Main MCP Server class with Zod-based type safety
*/
var MCPServer = class {
	config;
	tools;
	resources;
	prompts;
	constructor(config) {
		const { name = "MCP Server", version = "1.0.0", description = "MCP Server powered by AWS Lambda", protocolVersion = "2025-03-26", ...rest } = config;
		this.config = {
			name,
			version,
			description,
			protocolVersion,
			...rest
		};
		this.tools = /* @__PURE__ */ new Map();
		this.resources = /* @__PURE__ */ new Map();
		this.prompts = /* @__PURE__ */ new Map();
	}
	/**
	* Register a tool with Zod schema validation
	*/
	tool(name, inputSchema, handler) {
		const jsonSchema = zodToJsonSchema(inputSchema);
		const handlerDescription = handler.description;
		const validatedHandler = async (args) => {
			try {
				return await handler(validateWithZod(inputSchema, args));
			} catch (error) {
				if (error instanceof zod.z.ZodError) throw new Error(`Validation error: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`);
				throw error;
			}
		};
		this.tools.set(name, {
			name,
			description: handlerDescription || `Tool: ${name}`,
			inputSchema: jsonSchema,
			handler: validatedHandler
		});
		return this;
	}
	/**
	* Register a resource
	*/
	resource(name, uri, handler) {
		const handlerDescription = handler.description;
		this.resources.set(name, {
			name,
			uri,
			description: handlerDescription || `Resource: ${name}`,
			handler: async (resourceUri) => handler(resourceUri)
		});
		return this;
	}
	/**
	* Register a prompt with Zod schema validation
	*/
	prompt(name, inputSchema, handler) {
		zodToJsonSchema(inputSchema);
		const handlerDescription = handler.description;
		const validatedHandler = async (args) => {
			try {
				return await handler(validateWithZod(inputSchema, args));
			} catch (error) {
				if (error instanceof zod.z.ZodError) throw new Error(`Validation error: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`);
				throw error;
			}
		};
		this.prompts.set(name, {
			name,
			description: handlerDescription || `Prompt: ${name}`,
			arguments: Object.entries(inputSchema).map(([key, schema]) => ({
				name: key,
				description: schema.description || `${key} parameter`,
				required: !isZodOptional(schema)
			})),
			handler: validatedHandler
		});
		return this;
	}
	/**
	* Handle MCP protocol requests
	*/
	async handleRequest(request) {
		switch (request.method) {
			case "initialize": return this.handleInitialize();
			case "notifications/initialized": return null;
			case "tools/list": return this.handleToolsList();
			case "tools/call": return this.handleToolsCall(request.params);
			case "resources/list": return this.handleResourcesList();
			case "resources/read": return this.handleResourcesRead(request.params);
			case "prompts/list": return this.handlePromptsList();
			case "prompts/get": return this.handlePromptsGet(request.params);
			default: throw new Error(`Method not found: ${request.method}`);
		}
	}
	/**
	* Handle initialize request
	*/
	async handleInitialize() {
		return {
			protocolVersion: this.config.protocolVersion,
			capabilities: {
				tools: { listChanged: true },
				resources: { listChanged: true },
				prompts: { listChanged: true }
			},
			serverInfo: {
				name: this.config.name,
				version: this.config.version
			},
			instructions: this.config.description
		};
	}
	/**
	* Handle tools/list request
	*/
	async handleToolsList() {
		return { tools: Array.from(this.tools.values()).map((tool) => ({
			name: tool.name,
			description: tool.description,
			inputSchema: tool.inputSchema
		})) };
	}
	/**
	* Handle tools/call request
	*/
	async handleToolsCall(params) {
		if (!params?.name) throw new Error("Tool name is required");
		const tool = this.tools.get(params.name);
		if (!tool) throw new Error(`Tool not found: ${params.name}`);
		try {
			return await tool.handler(params.arguments || {});
		} catch (error) {
			return {
				content: [{
					type: "text",
					text: `Error: ${error instanceof Error ? error.message : String(error)}`
				}],
				isError: true
			};
		}
	}
	/**
	* Handle resources/list request
	*/
	async handleResourcesList() {
		return { resources: Array.from(this.resources.values()).map((resource) => ({
			uri: resource.uri,
			name: resource.name,
			description: resource.description
		})) };
	}
	/**
	* Handle resources/read request
	*/
	async handleResourcesRead(params) {
		if (!params?.uri) throw new Error("Resource URI is required");
		const resource = Array.from(this.resources.values()).find((r) => r.uri === params.uri);
		if (!resource) throw new Error(`Resource not found: ${params.uri}`);
		try {
			return await resource.handler(params.uri);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new Error(`Resource read error: ${errorMessage}`);
		}
	}
	/**
	* Handle prompts/list request
	*/
	async handlePromptsList() {
		return { prompts: Array.from(this.prompts.values()).map((prompt) => ({
			name: prompt.name,
			description: prompt.description,
			arguments: prompt.arguments
		})) };
	}
	/**
	* Handle prompts/get request
	*/
	async handlePromptsGet(params) {
		if (!params?.name) throw new Error("Prompt name is required");
		const prompt = this.prompts.get(params.name);
		if (!prompt) throw new Error(`Prompt not found: ${params.name}`);
		try {
			return await prompt.handler(params.arguments || {});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new Error(`Prompt execution error: ${errorMessage}`);
		}
	}
	/**
	* Get server statistics
	*/
	getStats() {
		return {
			tools: this.tools.size,
			resources: this.resources.size,
			prompts: this.prompts.size,
			config: this.config
		};
	}
};

//#endregion
//#region src/lambda-adapter.ts
/**
* Create HTTP response
*/
function createResponse(body, statusCode = 200, headers = {}) {
	return {
		statusCode,
		headers: {
			"Content-Type": "application/json",
			...headers
		},
		body: typeof body === "string" ? body : JSON.stringify(body)
	};
}
/**
* Create error response
*/
function createErrorResponse(statusCode, code, message, headers = {}, id = null) {
	return createResponse({
		jsonrpc: "2.0",
		error: {
			code,
			message
		},
		id
	}, statusCode, headers);
}
/**
* Handle MCP request processing
*/
async function handleMCPRequest(mcpServer, body, headers, corsHeaders) {
	if (!(headers["content-type"] || headers["Content-Type"] || "").includes("application/json")) return createErrorResponse(400, -32700, "Parse error: Content-Type must be application/json", corsHeaders);
	let jsonRpcMessage;
	try {
		jsonRpcMessage = JSON.parse(body || "{}");
	} catch {
		return createErrorResponse(400, -32700, "Parse error: Invalid JSON", corsHeaders);
	}
	const responseId = "id" in jsonRpcMessage ? jsonRpcMessage.id : null;
	if (!jsonRpcMessage.jsonrpc || jsonRpcMessage.jsonrpc !== "2.0") return createErrorResponse(400, -32600, "Invalid Request: missing jsonrpc field", corsHeaders, responseId);
	if (!jsonRpcMessage.method) return createErrorResponse(400, -32600, "Invalid Request: missing method field", corsHeaders, responseId);
	try {
		const result = await mcpServer.handleRequest(jsonRpcMessage);
		if (result === null) return createResponse("", 204, corsHeaders);
		return createResponse({
			jsonrpc: "2.0",
			result,
			id: responseId
		}, 200, corsHeaders);
	} catch (error) {
		console.error("MCP request error:", error);
		let errorCode = -32603;
		let errorMessage = error instanceof Error ? error.message : String(error);
		if (errorMessage.includes("Method not found")) errorCode = -32601;
		else if (errorMessage.includes("not found") || errorMessage.includes("required")) errorCode = -32602;
		return createErrorResponse(500, errorCode, errorMessage, corsHeaders, responseId);
	}
}
/**
* AWS Lambda Adapter for MCP Server
*/
function createLambdaHandler(mcpServer, options = {}) {
	const baseHandler = async (event) => {
		try {
			const method = "httpMethod" in event ? event.httpMethod : event.requestContext?.http?.method;
			const headers = event.headers || {};
			if (method === "OPTIONS") return createResponse("", 200, require_cors_config.CORS_HEADERS);
			if (method === "POST") return await handleMCPRequest(mcpServer, event.body, headers, require_cors_config.CORS_HEADERS);
			if (method === "GET") return createErrorResponse(405, -32e3, "Method not allowed: Stateless mode", require_cors_config.CORS_HEADERS);
			return createErrorResponse(405, -32e3, `Method not allowed: ${method}`, require_cors_config.CORS_HEADERS);
		} catch (error) {
			console.error("Lambda error:", error);
			return createErrorResponse(500, -32603, "Internal server error", require_cors_config.withBasicCORS({ "Content-Type": "application/json" }));
		}
	};
	if (options.auth) {
		const authConfig = options.auth;
		return async (event, context) => {
			try {
				const { createAuthenticatedHandler } = await Promise.resolve().then(() => require("./middleware-BZkZMXHu.cjs"));
				return await createAuthenticatedHandler(baseHandler, authConfig)(event, context);
			} catch (error) {
				console.error("Authentication module error:", error);
				return {
					statusCode: 500,
					headers: require_cors_config.withBasicCORS({ "Content-Type": "application/json" }),
					body: JSON.stringify({
						error: "server_error",
						message: "Authentication module not available"
					})
				};
			}
		};
	}
	return baseHandler;
}

//#endregion
//#region src/common-schemas.ts
/**
* Common Zod Schemas
*
* Pre-defined schemas for common use cases
*/
/**
* Common schema patterns for MCP tools
*/
const CommonSchemas = {
	string: zod.z.string(),
	number: zod.z.number(),
	boolean: zod.z.boolean(),
	optionalString: zod.z.string().optional(),
	optionalNumber: zod.z.number().optional(),
	optionalBoolean: zod.z.boolean().optional(),
	email: zod.z.string().email(),
	url: zod.z.string().url(),
	uuid: zod.z.string().uuid(),
	enum: (values) => zod.z.enum(values),
	array: (itemSchema) => zod.z.array(itemSchema),
	object: (shape) => zod.z.object(shape)
};

//#endregion
//#region src/index.ts
/**
* @aws-lambda-mcp/adapter
*
* An MCP (Model Context Protocol) server SDK for AWS Lambda
* with Zod-based type safety, authentication support, and clean separation of concerns.
*/
function createMCPServer(config) {
	return new MCPServer(config);
}

//#endregion
exports.CommonSchemas = CommonSchemas;
exports.MCPServer = MCPServer;
exports.createLambdaHandler = createLambdaHandler;
exports.createMCPServer = createMCPServer;
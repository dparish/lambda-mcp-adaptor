var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/cors-config.ts
function withCORS(additionalHeaders = {}) {
  return {
    ...CORS_HEADERS,
    ...additionalHeaders
  };
}
function withBasicCORS(additionalHeaders = {}) {
  return {
    ...BASIC_CORS_HEADERS,
    ...additionalHeaders
  };
}
var CORS_HEADERS, BASIC_CORS_HEADERS;
var init_cors_config = __esm({
  "src/cors-config.ts"() {
    "use strict";
    CORS_HEADERS = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Mcp-Protocol-Version, Mcp-Session-Id",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    };
    BASIC_CORS_HEADERS = {
      "Access-Control-Allow-Origin": "*"
    };
  }
});

// src/auth/bearer-token.ts
function createAuthErrorResponse(statusCode, error, message, additionalHeaders = {}) {
  const headers = withCORS({
    "Content-Type": "application/json",
    ...additionalHeaders
  });
  return {
    statusCode,
    headers,
    body: JSON.stringify({
      error,
      message
    })
  };
}
async function validateBearerToken(event, config = { type: "bearer-token" }) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader) {
    return {
      isValid: false,
      error: createAuthErrorResponse(
        401,
        "unauthorized",
        "Authorization header is required",
        { "WWW-Authenticate": 'Bearer realm="MCP Server"' }
      )
    };
  }
  if (!authHeader.startsWith("Bearer ")) {
    return {
      isValid: false,
      error: createAuthErrorResponse(
        401,
        "unauthorized",
        "Bearer token is required",
        { "WWW-Authenticate": 'Bearer realm="MCP Server"' }
      )
    };
  }
  const token = authHeader.substring(7);
  if (config.validate && typeof config.validate === "function") {
    try {
      const result = await config.validate(token, event);
      if (result && result.isValid) {
        return {
          isValid: true,
          user: result.user || { token },
          token
        };
      } else {
        return {
          isValid: false,
          error: result?.error || createAuthErrorResponse(
            401,
            "invalid_token",
            "Invalid or expired token",
            { "WWW-Authenticate": 'Bearer realm="MCP Server"' }
          )
        };
      }
    } catch (error) {
      console.error("Error in custom token validation:", error);
      return {
        isValid: false,
        error: createAuthErrorResponse(
          500,
          "server_error",
          "Authentication validation error"
        )
      };
    }
  }
  const validTokens = config.tokens || [];
  if (validTokens.length === 0) {
    console.warn("No valid tokens configured for Bearer token authentication.");
    return {
      isValid: false,
      error: createAuthErrorResponse(
        500,
        "server_error",
        "Authentication not configured"
      )
    };
  }
  if (!validTokens.includes(token)) {
    return {
      isValid: false,
      error: createAuthErrorResponse(
        401,
        "invalid_token",
        "Invalid or expired token",
        { "WWW-Authenticate": 'Bearer realm="MCP Server"' }
      )
    };
  }
  return {
    isValid: true,
    user: { token },
    token
  };
}
var init_bearer_token = __esm({
  "src/auth/bearer-token.ts"() {
    "use strict";
    init_cors_config();
  }
});

// src/auth/middleware.ts
var middleware_exports = {};
__export(middleware_exports, {
  createAuthMiddleware: () => createAuthMiddleware,
  createAuthenticatedHandler: () => createAuthenticatedHandler
});
function handleCORSPreflight(event) {
  const method = "httpMethod" in event ? event.httpMethod : event.requestContext?.http?.method;
  if (method === "OPTIONS") {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: ""
    };
  }
  return null;
}
function createAuthMiddleware(authConfig) {
  return async (event) => {
    const corsResponse = handleCORSPreflight(event);
    if (corsResponse) {
      return corsResponse;
    }
    let authResult;
    switch (authConfig.type) {
      case "bearer-token":
        authResult = await validateBearerToken(event, authConfig);
        break;
      default:
        console.error(`Unsupported authentication type: ${authConfig.type}`);
        return {
          statusCode: 500,
          headers: withBasicCORS({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            error: "server_error",
            message: "Unsupported authentication type"
          })
        };
    }
    if (!authResult.isValid) {
      console.log("Authentication failed:", authResult.error?.body);
      const fallbackError = {
        statusCode: 401,
        headers: withBasicCORS({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          error: "unauthorized",
          message: "Authentication failed"
        })
      };
      return authResult.error ?? fallbackError;
    }
    event.user = authResult.user;
    event.authToken = authResult.token;
    console.log("Authentication successful");
    return null;
  };
}
function createAuthenticatedHandler(originalHandler, authConfig) {
  const authMiddleware = createAuthMiddleware(authConfig);
  return async (event, context) => {
    console.log("=== MCP Server Request Start (with Authentication) ===");
    console.log("Event:", JSON.stringify(event, null, 2));
    try {
      const authResponse = await authMiddleware(event);
      if (authResponse) {
        return authResponse;
      }
      const response = await originalHandler(event, context);
      console.log("=== MCP Server Request End ===");
      return response;
    } catch (error) {
      console.error("Error in authenticated MCP server:", error);
      return {
        statusCode: 500,
        headers: withBasicCORS({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          error: "internal_server_error",
          message: "An internal server error occurred"
        })
      };
    }
  };
}
var init_middleware = __esm({
  "src/auth/middleware.ts"() {
    "use strict";
    init_bearer_token();
    init_cors_config();
  }
});

// src/mcp-server.ts
import { z as z2 } from "zod";

// src/schema-utils.ts
import { z } from "zod";
function zodToJsonSchema(zodSchema) {
  const properties = {};
  const required = [];
  for (const [key, schema] of Object.entries(zodSchema)) {
    properties[key] = convertZodTypeToJsonSchema(schema);
    if (!isZodOptional(schema)) {
      required.push(key);
    }
  }
  return {
    type: "object",
    properties,
    required
  };
}
function convertZodTypeToJsonSchema(zodType) {
  if (zodType instanceof z.ZodOptional) {
    const def = zodType._def;
    return convertZodTypeToJsonSchema(def.innerType);
  }
  if (zodType instanceof z.ZodDefault) {
    const def = zodType._def;
    const schema = convertZodTypeToJsonSchema(def.innerType);
    schema.default = def.defaultValue();
    return schema;
  }
  if (zodType instanceof z.ZodString) {
    const schema = { type: "string" };
    const def = zodType._def;
    if (def.checks) {
      for (const check of def.checks) {
        switch (check.kind) {
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
      }
    }
    if (zodType.description) {
      schema.description = zodType.description;
    }
    return schema;
  }
  if (zodType instanceof z.ZodNumber) {
    const schema = { type: "number" };
    const def = zodType._def;
    if (def.checks) {
      for (const check of def.checks) {
        switch (check.kind) {
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
      }
    }
    if (zodType.description) {
      schema.description = zodType.description;
    }
    return schema;
  }
  if (zodType instanceof z.ZodBoolean) {
    const schema = { type: "boolean" };
    if (zodType.description) {
      schema.description = zodType.description;
    }
    return schema;
  }
  if (zodType instanceof z.ZodEnum) {
    const def = zodType._def;
    const schema = {
      type: "string",
      enum: def.values
    };
    if (zodType.description) {
      schema.description = zodType.description;
    }
    return schema;
  }
  if (zodType instanceof z.ZodArray) {
    const schema = {
      type: "array",
      items: convertZodTypeToJsonSchema(zodType._def.type)
    };
    if (zodType._def.minLength) {
      schema.minItems = zodType._def.minLength.value;
    }
    if (zodType._def.maxLength) {
      schema.maxItems = zodType._def.maxLength.value;
    }
    if (zodType.description) {
      schema.description = zodType.description;
    }
    return schema;
  }
  if (zodType instanceof z.ZodObject) {
    return zodToJsonSchema(zodType.shape);
  }
  return {
    type: "string",
    description: zodType.description || "Unknown type"
  };
}
function isZodOptional(zodType) {
  return zodType instanceof z.ZodOptional || zodType instanceof z.ZodDefault;
}
function hasZodDefault(zodType) {
  return zodType instanceof z.ZodDefault;
}
function validateWithZod(zodSchema, args) {
  const validated = {};
  for (const [key, schema] of Object.entries(zodSchema)) {
    try {
      if (args[key] === void 0 && isZodOptional(schema)) {
        if (hasZodDefault(schema)) {
          validated[key] = schema.parse(void 0);
        }
        continue;
      }
      validated[key] = schema.parse(args[key]);
    } catch (error) {
      throw new z.ZodError([
        {
          code: "custom",
          path: [key],
          message: error instanceof Error ? error.message : String(error)
        }
      ]);
    }
  }
  return validated;
}

// src/mcp-server.ts
var MCPServer = class {
  config;
  tools;
  resources;
  prompts;
  constructor(config) {
    const {
      name = "MCP Server",
      version = "1.0.0",
      description = "MCP Server powered by AWS Lambda",
      protocolVersion = "2025-03-26",
      ...rest
    } = config;
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
        const validatedArgs = validateWithZod(inputSchema, args);
        return await handler(validatedArgs);
      } catch (error) {
        if (error instanceof z2.ZodError) {
          throw new Error(
            `Validation error: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
          );
        }
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
        const validatedArgs = validateWithZod(inputSchema, args);
        return await handler(validatedArgs);
      } catch (error) {
        if (error instanceof z2.ZodError) {
          throw new Error(
            `Validation error: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
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
      case "initialize":
        return this.handleInitialize();
      case "notifications/initialized":
        return null;
      case "tools/list":
        return this.handleToolsList();
      case "tools/call":
        return this.handleToolsCall(request.params);
      case "resources/list":
        return this.handleResourcesList();
      case "resources/read":
        return this.handleResourcesRead(request.params);
      case "prompts/list":
        return this.handlePromptsList();
      case "prompts/get":
        return this.handlePromptsGet(request.params);
      default:
        throw new Error(`Method not found: ${request.method}`);
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
    const tools = Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
    return { tools };
  }
  /**
   * Handle tools/call request
   */
  async handleToolsCall(params) {
    if (!params?.name) {
      throw new Error("Tool name is required");
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
        content: [{ type: "text", text: `Error: ${errorMessage}` }],
        isError: true
      };
    }
  }
  /**
   * Handle resources/list request
   */
  async handleResourcesList() {
    const resources = Array.from(this.resources.values()).map((resource) => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description
    }));
    return { resources };
  }
  /**
   * Handle resources/read request
   */
  async handleResourcesRead(params) {
    if (!params?.uri) {
      throw new Error("Resource URI is required");
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
  async handlePromptsList() {
    const prompts = Array.from(this.prompts.values()).map((prompt) => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments
    }));
    return { prompts };
  }
  /**
   * Handle prompts/get request
   */
  async handlePromptsGet(params) {
    if (!params?.name) {
      throw new Error("Prompt name is required");
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
  getStats() {
    return {
      tools: this.tools.size,
      resources: this.resources.size,
      prompts: this.prompts.size,
      config: this.config
    };
  }
};

// src/lambda-adapter.ts
init_cors_config();
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
function createErrorResponse(statusCode, code, message, headers = {}, id = null) {
  return createResponse(
    {
      jsonrpc: "2.0",
      error: { code, message },
      id
    },
    statusCode,
    headers
  );
}
async function handleMCPRequest(mcpServer, body, headers, corsHeaders) {
  const contentType = headers["content-type"] || headers["Content-Type"] || "";
  if (!contentType.includes("application/json")) {
    return createErrorResponse(
      400,
      -32700,
      "Parse error: Content-Type must be application/json",
      corsHeaders
    );
  }
  let jsonRpcMessage;
  try {
    jsonRpcMessage = JSON.parse(body || "{}");
  } catch {
    return createErrorResponse(
      400,
      -32700,
      "Parse error: Invalid JSON",
      corsHeaders
    );
  }
  const responseId = "id" in jsonRpcMessage ? jsonRpcMessage.id : null;
  if (!jsonRpcMessage.jsonrpc || jsonRpcMessage.jsonrpc !== "2.0") {
    return createErrorResponse(
      400,
      -32600,
      "Invalid Request: missing jsonrpc field",
      corsHeaders,
      responseId
    );
  }
  if (!jsonRpcMessage.method) {
    return createErrorResponse(
      400,
      -32600,
      "Invalid Request: missing method field",
      corsHeaders,
      responseId
    );
  }
  try {
    const result = await mcpServer.handleRequest(jsonRpcMessage);
    if (result === null) {
      return createResponse("", 204, corsHeaders);
    }
    return createResponse(
      {
        jsonrpc: "2.0",
        result,
        id: responseId
      },
      200,
      corsHeaders
    );
  } catch (error) {
    console.error("MCP request error:", error);
    let errorCode = -32603;
    let errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Method not found")) {
      errorCode = -32601;
    } else if (errorMessage.includes("not found") || errorMessage.includes("required")) {
      errorCode = -32602;
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
function createLambdaHandler(mcpServer, options = {}) {
  const baseHandler = async (event) => {
    try {
      const method = "httpMethod" in event ? event.httpMethod : event.requestContext?.http?.method;
      const headers = event.headers || {};
      if (method === "OPTIONS") {
        return createResponse("", 200, CORS_HEADERS);
      }
      if (method === "POST") {
        return await handleMCPRequest(
          mcpServer,
          event.body,
          headers,
          CORS_HEADERS
        );
      }
      if (method === "GET") {
        return createErrorResponse(
          405,
          -32e3,
          "Method not allowed: Stateless mode",
          CORS_HEADERS
        );
      }
      return createErrorResponse(
        405,
        -32e3,
        `Method not allowed: ${method}`,
        CORS_HEADERS
      );
    } catch (error) {
      console.error("Lambda error:", error);
      return createErrorResponse(
        500,
        -32603,
        "Internal server error",
        withBasicCORS({ "Content-Type": "application/json" })
      );
    }
  };
  if (options.auth) {
    const authConfig = options.auth;
    return async (event, context) => {
      try {
        const { createAuthenticatedHandler: createAuthenticatedHandler2 } = await Promise.resolve().then(() => (init_middleware(), middleware_exports));
        const authenticatedHandler = createAuthenticatedHandler2(
          baseHandler,
          authConfig
        );
        return await authenticatedHandler(event, context);
      } catch (error) {
        console.error("Authentication module error:", error);
        return {
          statusCode: 500,
          headers: withBasicCORS({ "Content-Type": "application/json" }),
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

// src/common-schemas.ts
import { z as z3 } from "zod";
var CommonSchemas = {
  // Basic types
  string: z3.string(),
  number: z3.number(),
  boolean: z3.boolean(),
  // Optional types
  optionalString: z3.string().optional(),
  optionalNumber: z3.number().optional(),
  optionalBoolean: z3.boolean().optional(),
  // Common patterns
  email: z3.string().email(),
  url: z3.string().url(),
  uuid: z3.string().uuid(),
  // Utility functions
  enum: (values) => z3.enum(values),
  array: (itemSchema) => z3.array(itemSchema),
  object: (shape) => z3.object(shape)
};

// src/index.ts
function createMCPServer(config) {
  return new MCPServer(config);
}
export {
  CommonSchemas,
  MCPServer,
  createLambdaHandler,
  createMCPServer
};

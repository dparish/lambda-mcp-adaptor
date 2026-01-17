const require_cors_config = require('./cors-config-HN36M-Ox.cjs');

//#region src/auth/bearer-token.ts
/**
* Bearer Token Authentication Module
*
* Provides Bearer token validation functionality for MCP servers
*/
/**
* Creates an authentication error response
* @param {number} statusCode - HTTP status code
* @param {string} error - Error code
* @param {string} message - Error message
* @param {Object} additionalHeaders - Additional headers to include
* @returns {Object} Lambda response object
*/
function createAuthErrorResponse(statusCode, error, message, additionalHeaders = {}) {
	return {
		statusCode,
		headers: require_cors_config.withCORS({
			"Content-Type": "application/json",
			...additionalHeaders
		}),
		body: JSON.stringify({
			error,
			message
		})
	};
}
/**
* Validates Bearer token from the Authorization header
* @param {Object} event - Lambda event object
* @param {Object} config - Authentication configuration
* @returns {Object} Validation result with isValid flag and error/user data
*/
async function validateBearerToken(event, config = { type: "bearer-token" }) {
	const authHeader = event.headers?.authorization || event.headers?.Authorization;
	if (!authHeader) return {
		isValid: false,
		error: createAuthErrorResponse(401, "unauthorized", "Authorization header is required", { "WWW-Authenticate": "Bearer realm=\"MCP Server\"" })
	};
	if (!authHeader.startsWith("Bearer ")) return {
		isValid: false,
		error: createAuthErrorResponse(401, "unauthorized", "Bearer token is required", { "WWW-Authenticate": "Bearer realm=\"MCP Server\"" })
	};
	const token = authHeader.substring(7);
	if (config.validate && typeof config.validate === "function") try {
		const result = await config.validate(token, event);
		if (result && result.isValid) return {
			isValid: true,
			user: result.user || { token },
			token
		};
		else return {
			isValid: false,
			error: result?.error || createAuthErrorResponse(401, "invalid_token", "Invalid or expired token", { "WWW-Authenticate": "Bearer realm=\"MCP Server\"" })
		};
	} catch (error) {
		console.error("Error in custom token validation:", error);
		return {
			isValid: false,
			error: createAuthErrorResponse(500, "server_error", "Authentication validation error")
		};
	}
	const validTokens = config.tokens || [];
	if (validTokens.length === 0) {
		console.warn("No valid tokens configured for Bearer token authentication.");
		return {
			isValid: false,
			error: createAuthErrorResponse(500, "server_error", "Authentication not configured")
		};
	}
	if (!validTokens.includes(token)) return {
		isValid: false,
		error: createAuthErrorResponse(401, "invalid_token", "Invalid or expired token", { "WWW-Authenticate": "Bearer realm=\"MCP Server\"" })
	};
	return {
		isValid: true,
		user: { token },
		token
	};
}

//#endregion
//#region src/auth/middleware.ts
/**
* Authentication Middleware Module
*
* Provides authentication middleware for MCP Lambda handlers
*/
/**
* Handles CORS preflight requests
* @param {Object} event - Lambda event object
* @returns {Object|null} CORS response or null if not a preflight request
*/
function handleCORSPreflight(event) {
	if (("httpMethod" in event ? event.httpMethod : event.requestContext?.http?.method) === "OPTIONS") return {
		statusCode: 200,
		headers: require_cors_config.CORS_HEADERS,
		body: ""
	};
	return null;
}
/**
* Creates an authentication middleware function
* @param {Object} authConfig - Authentication configuration
* @returns {Function} Middleware function
*/
function createAuthMiddleware(authConfig) {
	return async (event) => {
		const corsResponse = handleCORSPreflight(event);
		if (corsResponse) return corsResponse;
		let authResult;
		switch (authConfig.type) {
			case "bearer-token":
				authResult = await validateBearerToken(event, authConfig);
				break;
			default:
				console.error(`Unsupported authentication type: ${authConfig.type}`);
				return {
					statusCode: 500,
					headers: require_cors_config.withBasicCORS({ "Content-Type": "application/json" }),
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
				headers: require_cors_config.withBasicCORS({ "Content-Type": "application/json" }),
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
/**
* Creates an authenticated Lambda handler wrapper
* @param {Function} originalHandler - Original Lambda handler function
* @param {Object} authConfig - Authentication configuration
* @returns {Function} Wrapped handler with authentication
*/
function createAuthenticatedHandler(originalHandler, authConfig) {
	const authMiddleware = createAuthMiddleware(authConfig);
	return async (event, context) => {
		console.log("=== MCP Server Request Start (with Authentication) ===");
		console.log("Event:", JSON.stringify(event, null, 2));
		try {
			const authResponse = await authMiddleware(event);
			if (authResponse) return authResponse;
			const response = await originalHandler(event, context);
			console.log("=== MCP Server Request End ===");
			return response;
		} catch (error) {
			console.error("Error in authenticated MCP server:", error);
			return {
				statusCode: 500,
				headers: require_cors_config.withBasicCORS({ "Content-Type": "application/json" }),
				body: JSON.stringify({
					error: "internal_server_error",
					message: "An internal server error occurred"
				})
			};
		}
	};
}

//#endregion
exports.createAuthenticatedHandler = createAuthenticatedHandler;

//#region src/cors-config.ts
/**
* CORS Configuration
*
* Centralized CORS headers configuration for consistent handling across all modules
*/
/**
* Standard CORS headers for MCP server responses
* Includes all necessary headers for MCP protocol and authentication
*/
const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Mcp-Protocol-Version, Mcp-Session-Id",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};
/**
* Basic CORS headers for simple responses
*/
const BASIC_CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };
/**
* Create response headers with CORS
*/
function withCORS(additionalHeaders = {}) {
	return {
		...CORS_HEADERS,
		...additionalHeaders
	};
}
/**
* Create basic response headers with CORS
*/
function withBasicCORS(additionalHeaders = {}) {
	return {
		...BASIC_CORS_HEADERS,
		...additionalHeaders
	};
}

//#endregion
Object.defineProperty(exports, 'CORS_HEADERS', {
  enumerable: true,
  get: function () {
    return CORS_HEADERS;
  }
});
Object.defineProperty(exports, 'withBasicCORS', {
  enumerable: true,
  get: function () {
    return withBasicCORS;
  }
});
Object.defineProperty(exports, 'withCORS', {
  enumerable: true,
  get: function () {
    return withCORS;
  }
});
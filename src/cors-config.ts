/**
 * CORS Configuration
 *
 * Centralized CORS headers configuration for consistent handling across all modules
 */

/**
 * Standard CORS headers for MCP server responses
 * Includes all necessary headers for MCP protocol and authentication
 */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'Content-Type, Accept, Authorization, Mcp-Protocol-Version, Mcp-Session-Id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

/**
 * Basic CORS headers for simple responses
 */
export const BASIC_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
};

/**
 * Create response headers with CORS
 */
export function withCORS(additionalHeaders: Record<string, string> = {}): Record<string, string> {
  return {
    ...CORS_HEADERS,
    ...additionalHeaders,
  };
}

/**
 * Create basic response headers with CORS
 */
export function withBasicCORS(
  additionalHeaders: Record<string, string> = {}
): Record<string, string> {
  return {
    ...BASIC_CORS_HEADERS,
    ...additionalHeaders,
  };
}

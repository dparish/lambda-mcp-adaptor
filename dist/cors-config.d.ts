/**
 * CORS Configuration
 *
 * Centralized CORS headers configuration for consistent handling across all modules
 */
/**
 * Standard CORS headers for MCP server responses
 * Includes all necessary headers for MCP protocol and authentication
 */
export declare const CORS_HEADERS: Record<string, string>;
/**
 * Basic CORS headers for simple responses
 */
export declare const BASIC_CORS_HEADERS: Record<string, string>;
/**
 * Create response headers with CORS
 */
export declare function withCORS(additionalHeaders?: Record<string, string>): Record<string, string>;
/**
 * Create basic response headers with CORS
 */
export declare function withBasicCORS(additionalHeaders?: Record<string, string>): Record<string, string>;

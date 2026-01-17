/**
 * Schema Utilities
 *
 * Zod schema conversion and validation utilities
 */
import { z } from 'zod';
import type { JSONSchema7 } from 'json-schema';
/**
 * Convert Zod schema to JSON Schema
 */
export declare function zodToJsonSchema(zodSchema: z.ZodRawShape): JSONSchema7;
/**
 * Check if Zod type is optional
 */
export declare function isZodOptional(zodType: z.ZodTypeAny): boolean;
/**
 * Check if Zod type has default value
 */
export declare function hasZodDefault(zodType: z.ZodTypeAny): boolean;
/**
 * Validate arguments with Zod schema
 */
export declare function validateWithZod<T extends z.ZodRawShape>(zodSchema: T, args: Record<string, unknown>): z.infer<z.ZodObject<T>>;

/**
 * Schema Utilities
 *
 * Zod schema conversion and validation utilities
 */

import { z } from 'zod';
import type { JSONSchema7, JSONSchema7Type } from 'json-schema';

/**
 * Convert Zod schema to JSON Schema
 */
export function zodToJsonSchema(zodSchema: z.ZodRawShape): JSONSchema7 {
  const properties: Record<string, JSONSchema7> = {};
  const required: string[] = [];

  for (const [key, schema] of Object.entries(zodSchema)) {
    properties[key] = convertZodTypeToJsonSchema(schema);

    if (!isZodOptional(schema)) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    required,
  };
}

/**
 * Convert individual Zod type to JSON Schema
 */
function convertZodTypeToJsonSchema(zodType: z.ZodTypeAny): JSONSchema7 {
  type ZodCheck = { kind: string; value?: number };

  // Handle ZodOptional
  if (zodType instanceof z.ZodOptional) {
    const def = zodType._def as unknown as { innerType: z.ZodTypeAny };
    return convertZodTypeToJsonSchema(def.innerType);
  }

  // Handle ZodDefault
  if (zodType instanceof z.ZodDefault) {
    const def = zodType._def as unknown as {
      innerType: z.ZodTypeAny;
      defaultValue: () => unknown;
    };
    const schema = convertZodTypeToJsonSchema(def.innerType);
    schema.default = def.defaultValue() as JSONSchema7Type;
    return schema;
  }

  // Handle ZodString
  if (zodType instanceof z.ZodString) {
    const schema: JSONSchema7 = { type: 'string' };

    // Add constraints
    const def = zodType._def as unknown as { checks?: ZodCheck[] };
    if (def.checks) {
      for (const check of def.checks) {
        switch (check.kind) {
          case 'min':
            schema.minLength = check.value;
            break;
          case 'max':
            schema.maxLength = check.value;
            break;
          case 'email':
            schema.format = 'email';
            break;
          case 'url':
            schema.format = 'uri';
            break;
          case 'uuid':
            schema.format = 'uuid';
            break;
        }
      }
    }

    if (zodType.description) {
      schema.description = zodType.description;
    }

    return schema;
  }

  // Handle ZodNumber
  if (zodType instanceof z.ZodNumber) {
    const schema: JSONSchema7 = { type: 'number' };

    const def = zodType._def as unknown as { checks?: ZodCheck[] };
    if (def.checks) {
      for (const check of def.checks) {
        switch (check.kind) {
          case 'min':
            schema.minimum = check.value;
            break;
          case 'max':
            schema.maximum = check.value;
            break;
          case 'int':
            schema.type = 'integer';
            break;
        }
      }
    }

    if (zodType.description) {
      schema.description = zodType.description;
    }

    return schema;
  }

  // Handle ZodBoolean
  if (zodType instanceof z.ZodBoolean) {
    const schema: JSONSchema7 = { type: 'boolean' };

    if (zodType.description) {
      schema.description = zodType.description;
    }

    return schema;
  }

  // Handle ZodEnum
  if (zodType instanceof z.ZodEnum) {
    const def = zodType._def as unknown as { values: string[] };
    const schema: JSONSchema7 = {
      type: 'string',
      enum: def.values,
    };

    if (zodType.description) {
      schema.description = zodType.description;
    }

    return schema;
  }

  // Handle ZodArray
  if (zodType instanceof z.ZodArray) {
    const schema: JSONSchema7 = {
      type: 'array',
      items: convertZodTypeToJsonSchema(zodType._def.type),
    } ;

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

  // Handle ZodObject
  if (zodType instanceof z.ZodObject) {
    return zodToJsonSchema(zodType.shape);
  }

  // Fallback for unknown types
  return {
    type: 'string',
    description: zodType.description || 'Unknown type',
  };
}

/**
 * Check if Zod type is optional
 */
export function isZodOptional(zodType: z.ZodTypeAny): boolean {
  return zodType instanceof z.ZodOptional || zodType instanceof z.ZodDefault;
}

/**
 * Check if Zod type has default value
 */
export function hasZodDefault(zodType: z.ZodTypeAny): boolean {
  return zodType instanceof z.ZodDefault;
}

/**
 * Validate arguments with Zod schema
 */
export function validateWithZod<T extends z.ZodRawShape>(
  zodSchema: T,
  args: Record<string, unknown>
): z.infer<z.ZodObject<T>> {
  const validated: Partial<z.infer<z.ZodObject<T>>> = {};

  for (const [key, schema] of Object.entries(zodSchema)) {
    try {
      if (args[key] === undefined && isZodOptional(schema as z.ZodTypeAny)) {
        if (hasZodDefault(schema)) {
          validated[key as keyof typeof validated] = (
            schema as z.ZodDefault<z.ZodTypeAny>
          ).parse(undefined);
        }
        continue;
      }

      validated[key as keyof typeof validated] = (
        schema as z.ZodTypeAny
      ).parse(args[key]);
    } catch (error) {
      throw new z.ZodError([
        {
          code: 'custom',
          path: [key],
          message: error instanceof Error ? error.message : String(error),
        },
      ]);
    }
  }

  return validated as z.infer<z.ZodObject<T>>;
}

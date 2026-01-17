/**
 * Common Zod Schemas
 *
 * Pre-defined schemas for common use cases
 */
import { z } from 'zod';
/**
 * Common schema patterns for MCP tools
 */
export declare const CommonSchemas: {
    string: z.ZodString;
    number: z.ZodNumber;
    boolean: z.ZodBoolean;
    optionalString: z.ZodOptional<z.ZodString>;
    optionalNumber: z.ZodOptional<z.ZodNumber>;
    optionalBoolean: z.ZodOptional<z.ZodBoolean>;
    email: z.ZodString;
    url: z.ZodString;
    uuid: z.ZodString;
    enum: <T extends readonly [string, ...string[]]>(values: T) => z.ZodEnum<z.Writeable<T>>;
    array: <T extends z.ZodTypeAny>(itemSchema: T) => z.ZodArray<T, "many">;
    object: <T extends z.ZodRawShape>(shape: T) => z.ZodObject<T, "strip", z.ZodTypeAny, z.objectUtil.addQuestionMarks<z.baseObjectOutputType<T>, any> extends infer T_1 ? { [k in keyof T_1]: z.objectUtil.addQuestionMarks<z.baseObjectOutputType<T>, any>[k]; } : never, z.baseObjectInputType<T> extends infer T_2 ? { [k_1 in keyof T_2]: z.baseObjectInputType<T>[k_1]; } : never>;
};

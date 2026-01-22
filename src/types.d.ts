// This is the generic json schema type used in the mcp spec

export type JSONSchema = {
  $schema?: string;
  type: 'object';
  properties?: { [key: string]: object };
  required?: string[];
};

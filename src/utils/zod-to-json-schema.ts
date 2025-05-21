import { z } from 'zod';

/**
 * Simple utility to convert Zod schemas to JSON Schema
 * This is a very basic implementation that handles just our specific use cases
 */
export function zodToJsonSchema(schema: z.ZodType<any>): any {
  if (schema instanceof z.ZodObject) {
    const shape = (schema as any)._def.shape();
    const properties: Record<string, any> = {};
    const required: string[] = [];
    
    for (const key in shape) {
      const field = shape[key];
      properties[key] = zodTypeToJsonSchema(field);
      
      // Check if the field is required
      if (!(field instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }
  
  return { type: 'object' };
}

function zodTypeToJsonSchema(field: z.ZodType<any>): any {
  if (field instanceof z.ZodString) {
    return { type: 'string' };
  }
  if (field instanceof z.ZodNumber) {
    return { type: 'number' };
  }
  if (field instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }
  if (field instanceof z.ZodArray) {
    return { 
      type: 'array',
      items: zodTypeToJsonSchema((field as any)._def.type)
    };
  }
  if (field instanceof z.ZodOptional) {
    return zodTypeToJsonSchema((field as any)._def.innerType);
  }
  if (field instanceof z.ZodDefault) {
    const schema = zodTypeToJsonSchema((field as any)._def.innerType);
    schema.default = (field as any)._def.defaultValue();
    return schema;
  }
  
  return { type: 'string' };
}
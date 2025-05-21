import { describe, it, expect } from 'vitest';
import {
  ExecuteCommandArgsSchema,
  ReadOutputArgsSchema,
  ForceTerminateArgsSchema,
  ListSessionsArgsSchema,
  ClaudeCodeArgsSchema
} from '../tools/schemas.js';

describe('Schema Validation', () => {
  describe('ExecuteCommandArgsSchema', () => {
    it('should validate valid execute command args', () => {
      const result = ExecuteCommandArgsSchema.safeParse({
        command: 'echo test',
        timeout_ms: 5000,
        wait: false
      });
      expect(result.success).toBe(true);
    });
    
    it('should use default values for optional parameters', () => {
      const result = ExecuteCommandArgsSchema.safeParse({
        command: 'echo test'
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.wait).toBe(true); // Default value
        expect(result.data.timeout_ms).toBeUndefined(); // No default
      }
    });
    
    it('should require command parameter', () => {
      const result = ExecuteCommandArgsSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toEqual(['command']);
      }
    });
  });

  describe('ReadOutputArgsSchema', () => {
    it('should validate valid read output args', () => {
      const result = ReadOutputArgsSchema.safeParse({
        pid: 1234
      });
      expect(result.success).toBe(true);
    });
    
    it('should require pid parameter', () => {
      const result = ReadOutputArgsSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toEqual(['pid']);
      }
    });
    
    it('should validate pid is a number', () => {
      const result = ReadOutputArgsSchema.safeParse({
        pid: '1234'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].code).toBe('invalid_type');
      }
    });
  });

  describe('ForceTerminateArgsSchema', () => {
    it('should validate valid force terminate args', () => {
      const result = ForceTerminateArgsSchema.safeParse({
        pid: 1234
      });
      expect(result.success).toBe(true);
    });
    
    it('should require pid parameter', () => {
      const result = ForceTerminateArgsSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toEqual(['pid']);
      }
    });
  });

  describe('ListSessionsArgsSchema', () => {
    it('should validate empty object', () => {
      const result = ListSessionsArgsSchema.safeParse({});
      expect(result.success).toBe(true);
    });
    
    it('should reject non-object input', () => {
      const result = ListSessionsArgsSchema.safeParse('not an object');
      expect(result.success).toBe(false);
    });
  });

  describe('ClaudeCodeArgsSchema', () => {
    it('should validate valid claude code args', () => {
      const result = ClaudeCodeArgsSchema.safeParse({
        prompt: 'Test prompt',
        workFolder: '/path/to/folder',
        wait: false
      });
      expect(result.success).toBe(true);
    });
    
    it('should use default wait=true', () => {
      const result = ClaudeCodeArgsSchema.safeParse({
        prompt: 'Test prompt'
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.wait).toBe(true);
      }
    });
    
    it('should require prompt parameter', () => {
      const result = ClaudeCodeArgsSchema.safeParse({
        workFolder: '/path/to/folder'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toEqual(['prompt']);
      }
    });
    
    it('should validate workFolder is string when provided', () => {
      const result = ClaudeCodeArgsSchema.safeParse({
        prompt: 'Test prompt',
        workFolder: 123
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toEqual(['workFolder']);
      }
    });
    
    it('should validate wait is boolean when provided', () => {
      const result = ClaudeCodeArgsSchema.safeParse({
        prompt: 'Test prompt',
        wait: 'not a boolean'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toEqual(['wait']);
      }
    });
  });
});
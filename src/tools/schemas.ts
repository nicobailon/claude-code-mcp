import { z } from "zod";

// Terminal tools schemas
export const ExecuteCommandArgsSchema = z.object({
  command: z.string(),
  timeout_ms: z.number().optional(),
  shell: z.string().optional(),
  wait: z.boolean().optional().default(true),
});

export const ReadOutputArgsSchema = z.object({
  pid: z.number(),
});

export const ForceTerminateArgsSchema = z.object({
  pid: z.number(),
});

export const ListSessionsArgsSchema = z.object({});

// Extend the existing Claude Code schema to include wait parameter
export const ClaudeCodeArgsSchema = z.object({
  prompt: z.string(),
  workFolder: z.string().optional(),
  wait: z.boolean().optional().default(true)
});
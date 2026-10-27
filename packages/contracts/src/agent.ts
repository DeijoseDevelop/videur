import { z } from "zod";
import { AgentRunStatusSchema, MessageRoleSchema } from "./common";

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  ok: boolean;
  content: string;
  durationMs: number;
  error?: string;
}

export interface ToolUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface Message {
  id: string;
  projectId: string;
  runId: string | null;
  role: z.infer<typeof MessageRoleSchema>;
  content: string;
  toolCalls: ToolCall[] | null;
  toolResults: ToolResult[] | null;
  usage: ToolUsage | null;
  createdAt: string;
}

export interface AgentRun {
  id: string;
  projectId: string;
  providerId: string | null;
  model: string;
  status: z.infer<typeof AgentRunStatusSchema>;
  prompt: string;
  iterations: number;
  inputTokens: number;
  outputTokens: number;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export const StartAgentSchema = z.object({
  prompt: z.string().trim().min(1, "El prompt es obligatorio").max(8000),
  providerId: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).max(200).optional(),
  maxIterations: z.number().int().min(1).max(30).optional(),
  visionReview: z.boolean().optional(),
});

export type StartAgentInput = z.infer<typeof StartAgentSchema>;

export interface AgentStartResult {
  runId: string;
  status: z.infer<typeof AgentRunStatusSchema>;
  provider: string;
  model: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface VisionAnalysis {
  ok: boolean;
  summary: string;
  issues: Array<{ frame?: string; problem: string; fix?: string }>;
}

import "server-only";
import { generateObject, generateText, type LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { ZodType } from "zod";

/**
 * Resolves a language model. Order of preference:
 *  1. Vercel AI Gateway (AI_GATEWAY_API_KEY) — plain "provider/model" string.
 *  2. Direct Anthropic key (ANTHROPIC_API_KEY).
 *  3. null → caller uses the deterministic fallback planner.
 */
export function hasLLM(): boolean {
  return !!(process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY);
}

export function getModel(): LanguageModel | null {
  const modelId = process.env.PULSE_MODEL ?? "anthropic/claude-sonnet-4-6";
  if (process.env.AI_GATEWAY_API_KEY) {
    // AI SDK v6 resolves bare "provider/model" strings through the gateway.
    return modelId;
  }
  if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return anthropic(modelId.replace(/^anthropic\//, ""));
  }
  return null;
}

export async function llmObject<T>(args: {
  schema: ZodType<T>;
  system: string;
  prompt: string;
  temperature?: number;
}): Promise<T | null> {
  const model = getModel();
  if (!model) return null;
  try {
    const { object } = await generateObject({
      model,
      schema: args.schema,
      system: args.system,
      prompt: args.prompt,
      temperature: args.temperature ?? 0.1,
    });
    return object;
  } catch (e) {
    console.error("[pulse] llmObject error:", (e as Error).message);
    return null;
  }
}

export async function llmText(args: { system: string; prompt: string; temperature?: number }): Promise<string | null> {
  const model = getModel();
  if (!model) return null;
  try {
    const { text } = await generateText({
      model,
      system: args.system,
      prompt: args.prompt,
      temperature: args.temperature ?? 0.3,
    });
    return text;
  } catch (e) {
    console.error("[pulse] llmText error:", (e as Error).message);
    return null;
  }
}

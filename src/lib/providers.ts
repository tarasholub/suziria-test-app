import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { groq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

export type ProviderId = "google" | "groq" | "anthropic" | "openai";

interface ProviderDefinition {
  id: ProviderId;
  label: string;
  envKey: string;
  defaultModel: string;
  modelEnvKey: string;
  create: (modelId: string) => LanguageModel;
}

const PROVIDERS: Record<ProviderId, ProviderDefinition> = {
  google: {
    id: "google",
    label: "Gemini",
    envKey: "GOOGLE_GENERATIVE_AI_API_KEY",
    defaultModel: "gemini-3.8-flash",
    modelEnvKey: "GOOGLE_MODEL",
    create: (m) => google(m),
  },
  groq: {
    id: "groq",
    label: "Groq",
    envKey: "GROQ_API_KEY",
    defaultModel: "openai/gpt-oss-120b",
    modelEnvKey: "GROQ_MODEL",
    create: (m) => groq(m),
  },
  anthropic: {
    id: "anthropic",
    label: "Claude",
    envKey: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-5-5",
    modelEnvKey: "ANTHROPIC_MODEL",
    create: (m) => anthropic(m),
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    envKey: "OPENAI_API_KEY",
    defaultModel: "gpt-5",
    modelEnvKey: "OPENAI_MODEL",
    create: (m) => openai(m),
  },
};

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  model: string;
  available: boolean;
}

function modelIdFor(def: ProviderDefinition): string {
  return process.env[def.modelEnvKey] || def.defaultModel;
}

export function listProviders(): ProviderInfo[] {
  return Object.values(PROVIDERS).map((def) => ({
    id: def.id,
    label: def.label,
    model: modelIdFor(def),
    available: Boolean(process.env[def.envKey]),
  }));
}

export function getModel(providerId: string): LanguageModel {
  const def = PROVIDERS[providerId as ProviderId];
  if (!def) throw new Error(`Unknown provider: ${providerId}`);
  if (!process.env[def.envKey]) {
    throw new Error(`Provider "${def.label}" is not configured: set ${def.envKey}`);
  }
  return def.create(modelIdFor(def));
}

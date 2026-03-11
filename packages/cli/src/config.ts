/**
 * Config management for OpenBrain CLI.
 * Stores configuration in ~/.openbrain/config.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

export interface OpenBrainConfig {
  supabaseUrl: string;
  supabaseKey: string;
  embeddingProvider: "gemini" | "openai";
  geminiApiKey: string;
  openaiApiKey: string;
}

const CONFIG_DIR = resolve(homedir(), ".openbrain");
const CONFIG_PATH = resolve(CONFIG_DIR, "config.json");

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function configExists(): boolean {
  return existsSync(CONFIG_PATH);
}

export function loadConfig(): OpenBrainConfig {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(
      `Config not found. Run 'openbrain setup' first.\nExpected: ${CONFIG_PATH}`
    );
  }
  const raw = readFileSync(CONFIG_PATH, "utf-8");
  return JSON.parse(raw);
}

export function saveConfig(config: OpenBrainConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", {
    mode: 0o600,
  });
}

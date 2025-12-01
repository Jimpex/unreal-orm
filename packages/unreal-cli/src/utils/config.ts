/**
 * Configuration loading utilities.
 * Handles loading configuration from unreal.config.json (preferred) or .ts (legacy).
 *
 * The config only contains the path to the unreal folder.
 * Connection details are in unreal/surreal.ts (user-editable).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createJiti } from "jiti";
import { ui } from "./ui";

// Create a jiti instance for importing TypeScript files
const jiti = createJiti(import.meta.url, {
	interopDefault: true,
});

/**
 * Import a TypeScript file using jiti.
 * This allows importing .ts files without requiring a TypeScript loader.
 */
export async function importTs<T = unknown>(filePath: string): Promise<T> {
	return jiti.import(filePath) as Promise<T>;
}

/** Type for surreal.ts module exports */
export interface SurrealModule {
	getDatabase?: () => Promise<unknown>;
	connect?: () => Promise<unknown>;
	close?: () => Promise<void>;
	default?: SurrealModule | unknown;
}

/** JSON config structure (matches unreal.schema.json) */
interface JsonConfig {
	$schema?: string;
	path?: string;
}

/** Internal config representation */
export interface UnrealConfig {
	/** Path to the unreal folder */
	path: string;
}

/**
 * Attempts to load configuration from unreal.config.json (preferred) or unreal.config.ts (legacy).
 * Returns null if no config file is found.
 */
export async function loadConfig(
	cwd: string = process.cwd(),
): Promise<UnrealConfig | null> {
	const jsonPath = join(cwd, "unreal.config.json");
	const tsPath = join(cwd, "unreal.config.ts");

	// Prefer JSON format (new standard)
	if (existsSync(jsonPath)) {
		try {
			const content = readFileSync(jsonPath, "utf-8");
			const json = JSON.parse(content) as JsonConfig;
			return {
				path: json.path || "./unreal",
			};
		} catch (error) {
			console.warn(
				"Warning: Found unreal.config.json but failed to load it:",
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	// Fallback to TS format (legacy)
	if (existsSync(tsPath)) {
		try {
			const module = await importTs<{
				default: { schema?: { output?: string } };
			}>(tsPath);
			const legacy = module.default;
			// Legacy format had schema.output, convert to new format
			return {
				path: legacy.schema?.output?.replace("/tables", "") || "./unreal",
			};
		} catch (error) {
			console.warn(
				"Warning: Found unreal.config.ts but failed to load it:",
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	return null;
}

/**
 * Gets the path to the unreal folder from config.
 */
export function getUnrealPath(config: UnrealConfig): string {
	return config.path || "./unreal";
}

/**
 * Gets the tables directory path from config.
 */
export function getTablesPath(config: UnrealConfig): string {
	return join(config.path || "./unreal", "tables");
}

/**
 * Gets the surreal.ts path from config.
 */
export function getSurrealPath(config: UnrealConfig): string {
	return join(config.path || "./unreal", "surreal.ts");
}

/**
 * Suggests running init command if no config is found.
 */
export function suggestInit(): never {
	ui.error("No configuration found.");
	ui.info("Please run 'unreal init' to create a configuration file first.");
	ui.newline();
	process.exit(1);
}

/**
 * Options for resolving schema directory.
 */
export interface ResolveSchemaOptions {
	/** CLI output flag value */
	cliOutput?: string;
	/** Loaded config (if available) */
	config: UnrealConfig | null;
	/** Whether to prompt if not provided */
	allowPrompt?: boolean;
}

/**
 * Resolves the schema directory from config, CLI flag, or prompt.
 * Also displays config loaded message if applicable.
 *
 * @returns The resolved schema directory path
 */
export async function resolveSchemaDir(
	options: ResolveSchemaOptions,
): Promise<string> {
	const { cliOutput, config, allowPrompt = true } = options;

	// Priority 1: CLI flag
	if (cliOutput) {
		return cliOutput;
	}

	// Priority 2: Config with valid path
	if (config?.path) {
		ui.dim("✓ Loaded configuration from unreal.config.json");
		ui.newline();
		return getTablesPath(config);
	}

	// Priority 3: Config exists but path is empty
	if (config && !config.path) {
		ui.warn("Configuration found but 'path' is not set.");
		ui.dim("Tip: Run 'unreal init' to set up your project properly");
		ui.newline();
	} else if (!config) {
		ui.dim("No configuration found.");
		ui.dim("Tip: Run 'unreal init' to set up a project with saved settings");
		ui.newline();
	}

	// Priority 4: Prompt for path
	if (allowPrompt) {
		const { promptText } = await import("./prompts");
		const schemaDir = await promptText(
			"Schema directory path:",
			"./unreal/tables",
		);
		return schemaDir || "./unreal/tables";
	}

	// Default fallback
	return "./unreal/tables";
}

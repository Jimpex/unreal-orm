import { Surreal } from "surrealdb";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ConnectionConfig } from "../config/types";
import {
	type UnrealConfig,
	getSurrealPath,
	importTs,
	type SurrealModule,
	suggestInit,
} from "./config";
import {
	promptForConnection,
	promptSelectWithDisabled,
	type ConnectionPromptOptions,
} from "./prompts";
import { ui } from "./ui";

/**
 * CLI connection options that can be passed to commands.
 * These are the common flags across all database commands.
 */
export interface ConnectionCliOptions {
	url?: string;
	username?: string;
	password?: string;
	namespace?: string;
	database?: string;
	authLevel?: string;
	embedded?: string;
}

/**
 * Options for resolving a database connection.
 */
export interface ResolveConnectionOptions {
	/** CLI options passed to the command */
	cliOptions: ConnectionCliOptions;
	/** Loaded unreal config (if available) */
	config: UnrealConfig | null;
	/** Whether to prompt for connection if no config/flags provided */
	allowPrompt?: boolean;
	/** Whether to exit if no connection can be established */
	exitOnFailure?: boolean;
	/** Skip auto-loading from config, always show config/manual choice prompt */
	skipAutoConfig?: boolean;
}

/**
 * Resolves a database connection using the following priority:
 * 1. CLI flags (if any connection flags provided)
 * 2. Config-based connection (surreal.ts)
 * 3. Interactive prompt (if allowPrompt=true)
 * 4. Suggest init (if exitOnFailure=true)
 *
 * This is the unified connection handler for all commands.
 */
export async function resolveConnection(
	options: ResolveConnectionOptions,
): Promise<Surreal | null> {
	const {
		cliOptions,
		config,
		allowPrompt = true,
		exitOnFailure = true,
		skipAutoConfig = false,
	} = options;

	// Check if CLI connection flags were provided
	const hasConnectionFlags =
		cliOptions.url ||
		cliOptions.username ||
		cliOptions.password ||
		cliOptions.namespace ||
		cliOptions.database ||
		cliOptions.authLevel ||
		cliOptions.embedded;

	// Priority 1: Use CLI flags
	if (hasConnectionFlags) {
		const promptOptions: ConnectionPromptOptions = {
			url: cliOptions.url,
			username: cliOptions.username,
			password: cliOptions.password,
			namespace: cliOptions.namespace,
			database: cliOptions.database,
			authLevel: cliOptions.authLevel,
			embedded: cliOptions.embedded,
		};

		const finalConfig = await promptForConnection(promptOptions);
		return createConnection(finalConfig);
	}

	// Priority 2: Use config (surreal.ts) - skip if skipAutoConfig is true
	if (config && !skipAutoConfig) {
		const surrealPath = resolve(process.cwd(), getSurrealPath(config));

		if (existsSync(surrealPath)) {
			return loadFromSurrealTs(surrealPath);
		}
	}

	// Priority 3: Interactive prompt (config/manual choice)
	if (allowPrompt) {
		// Check if surreal.ts exists
		const hasSurrealTs = config
			? existsSync(resolve(process.cwd(), getSurrealPath(config)))
			: false;

		// Always show both options, disable config if not available
		const choice = await promptSelectWithDisabled("Connection method:", [
			{
				title: hasSurrealTs
					? "Use config (surreal.ts)"
					: "Use config (surreal.ts) - not found",
				value: "config",
				disabled: !hasSurrealTs,
			},
			{ title: "Enter connection details manually", value: "manual" },
		]);

		if (!choice) {
			process.exit(0);
		}

		if (choice === "config" && config) {
			const surrealPath = resolve(process.cwd(), getSurrealPath(config));
			return loadFromSurrealTs(surrealPath);
		}

		// Manual connection prompt
		const finalConfig = await promptForConnection({});
		return createConnection(finalConfig);
	}

	// Priority 4: No connection possible
	if (exitOnFailure) {
		suggestInit();
	}

	return null;
}

/**
 * Load database connection from surreal.ts file.
 */
async function loadFromSurrealTs(surrealPath: string): Promise<Surreal> {
	const spinner = ui.spin("Loading database client from surreal.ts...");

	try {
		// Load .env file before importing surreal.ts (which reads env vars)
		// This ensures CLI works regardless of runtime environment
		try {
			const dotenv = await import("dotenv");
			dotenv.config({ quiet: true });
		} catch {
			// dotenv not installed - env vars must be set by environment
		}

		const surrealModule = await importTs<SurrealModule>(surrealPath);

		let db: Surreal | undefined;

		if (surrealModule.getDatabase) {
			db = (await surrealModule.getDatabase()) as Surreal;
		} else if (surrealModule.connect) {
			db = (await surrealModule.connect()) as Surreal;
		} else if (
			surrealModule.default &&
			typeof surrealModule.default === "object" &&
			"getDatabase" in surrealModule.default
		) {
			const mod = surrealModule.default as SurrealModule;
			if (mod.getDatabase) {
				db = (await mod.getDatabase()) as Surreal;
			}
		} else if (surrealModule.default) {
			db = surrealModule.default as Surreal;
		}

		if (!db) {
			spinner.fail("surreal.ts must export getDatabase() or connect()");
			process.exit(1);
		}

		spinner.succeed("Connected using surreal.ts");
		return db;
	} catch (error) {
		spinner.fail("Failed to load surreal.ts");
		ui.error(error instanceof Error ? error.message : String(error));
		ui.newline();
		ui.dim("Tip: You can also provide connection flags directly:");
		ui.dim(
			"  unreal <command> --url ws://localhost:8000 -u root -p root -n test -d test",
		);
		ui.newline();
		process.exit(1);
	}
}

export async function createConnection(
	config: ConnectionConfig,
): Promise<Surreal> {
	let db: Surreal;

	if ("embedded" in config) {
		// Embedded mode
		try {
			const { createNodeEngines } = await import("@surrealdb/node");

			const engine = config.embedded === "memory" ? "mem://" : config.embedded;
			// @ts-ignore - Types mismatch between surrealdb and @surrealdb/node due to version differences
			db = new Surreal({ engines: createNodeEngines() });

			await db.connect(engine, config);
		} catch (error) {
			throw new Error(
				`Failed to initialize embedded SurrealDB. Make sure @surrealdb/node is installed and your environment supports native bindings.\nOriginal Error: ${error}`,
			);
		}
	} else {
		// Remote mode. Connect and authenticate in one call.
		db = new Surreal();
		await db.connect(config.url, config);
	}

	// Select namespace and database
	if (config.namespace && config.database) {
		await db.use({ namespace: config.namespace, database: config.database });
	}

	return db;
}

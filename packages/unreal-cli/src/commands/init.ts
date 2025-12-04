import { Command } from "@commander-js/extra-typings";
import prompts from "prompts";
import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import type { ConnectionConfig } from "../config/types";
import type { RootAuth, NamespaceAuth, DatabaseAuth } from "surrealdb";
import { ui } from "../utils/ui";

/** Handle Ctrl+C gracefully */
const onCancel = () => {
	ui.newline();
	ui.warn("Operation cancelled.");
	process.exit(0);
};

export const initCommand = new Command("init")
	.description("Initialize UnrealORM in your project")
	.option("--url <url>", "SurrealDB URL")
	.option("-u, --username <username>", "Database username")
	.option("-p, --password <password>", "Database password")
	.option("-n, --namespace <ns>", "Namespace")
	.option("-d, --database <db>", "Database")
	.option("-e, --embedded <mode>", "Embedded mode (memory or file path)")
	.option("--sample", "Generate sample schema tables")
	.option("--from-db", "Import schema from existing database")
	.option("--from-surql <file>", "Import schema from .surql file")
	.option("--install", "Install dependencies automatically")
	.option("--no-install", "Skip dependency installation")
	.option("--pm <manager>", "Package manager (npm, yarn, pnpm, bun)")
	.action(async (options) => {
		ui.header("🚀 UnrealORM Setup", "Initialize your project with UnrealORM");

		let connectionConfig: ConnectionConfig;
		let connectionMode: string | undefined;

		// Determine mode from flags or prompt
		if (options.url) {
			connectionMode = "remote";
		} else if (options.embedded) {
			connectionMode = options.embedded === "memory" ? "memory" : "file";
		} else {
			const response = await prompts(
				{
					type: "select",
					name: "connectionMode",
					message: "How will you connect to SurrealDB?",
					choices: [
						{
							title: "Remote (URL)",
							value: "remote",
							description: "Connect via WebSocket/HTTP",
						},
						{
							title: "Embedded (Memory)",
							value: "memory",
							description: "In-memory, great for dev/testing",
						},
						{
							title: "Embedded (File)",
							value: "file",
							description: "Persist to local file",
						},
					],
				},
				{ onCancel },
			);
			connectionMode = response.connectionMode;
		}

		if (!connectionMode) {
			ui.error("Operation cancelled.");
			process.exit(1);
		}

		if (connectionMode === "remote") {
			// 1. URL
			const url =
				options.url ||
				(
					await prompts(
						{
							type: "text",
							name: "url",
							message: "SurrealDB URL:",
							initial: "ws://localhost:8000",
						},
						{ onCancel },
					)
				).url;

			// 2. Auth details
			let username = options.username;
			let password = options.password;
			let authLevel = "root"; // Default assumption if flags provided

			if (!username || !password) {
				// If credentials missing, ask via wizard
				const authResponse = await prompts(
					[
						{
							type: options.username ? null : "select",
							name: "authLevel",
							message: "Authentication level:",
							choices: [
								{ title: "Root", value: "root" },
								{ title: "Namespace", value: "namespace" },
								{ title: "Database", value: "database" },
							],
						},
						{
							type: options.username ? null : "text",
							name: "username",
							message: "Username:",
							initial: "root",
						},
						{
							type: options.password ? null : "password",
							name: "password",
							message: "Password:",
						},
					],
					{ onCancel },
				);
				username = options.username || authResponse.username;
				password = options.password || authResponse.password;
				authLevel = authResponse.authLevel || "root";
			}

			// 3. Namespace / Database
			let namespace = options.namespace;
			let database = options.database;

			// Logic to ask for NS/DB based on auth level or missing flags
			const questions: prompts.PromptObject[] = [];

			if (!namespace && (authLevel !== "root" || !database)) {
				questions.push({
					type: "text",
					name: "namespace",
					message: "Namespace:",
					initial: "test",
				});
			}
			if (!database) {
				questions.push({
					type: "text",
					name: "database",
					message: "Database:",
					initial: "test",
				});
			}

			if (questions.length > 0) {
				const nsDbResponse = await prompts(questions, { onCancel });
				namespace = namespace || nsDbResponse.namespace;
				database = database || nsDbResponse.database;
			}

			// Construct config
			let authConfig: RootAuth | NamespaceAuth | DatabaseAuth;
			const user = username || "";
			const pass = password || "";

			if (authLevel === "database" && namespace && database) {
				authConfig = { username: user, password: pass, namespace, database };
			} else if (authLevel === "namespace" && namespace) {
				authConfig = { username: user, password: pass, namespace };
			} else {
				authConfig = { username: user, password: pass };
			}

			connectionConfig = {
				url,
				authentication: authConfig,
				namespace,
				database,
			};
		} else if (connectionMode === "memory") {
			// Embedded Memory
			let namespace = options.namespace;
			let database = options.database;

			if (!namespace || !database) {
				const response = await prompts(
					[
						{
							type: namespace ? null : "text",
							name: "namespace",
							message: "Namespace:",
							initial: "test",
						},
						{
							type: database ? null : "text",
							name: "database",
							message: "Database:",
							initial: "test",
						},
					],
					{ onCancel },
				);
				namespace = namespace || response.namespace;
				database = database || response.database;
			}

			connectionConfig = {
				embedded: "memory",
				namespace,
				database,
			};
			ui.newline();
			ui.warn("Note: Embedded mode requires @surrealdb/node package");
		} else {
			// Embedded File
			let filePath =
				options.embedded !== "surrealkv" ? options.embedded : undefined;
			let namespace = options.namespace;
			let database = options.database;

			if (!filePath) {
				const res = await prompts(
					{
						type: "text",
						name: "path",
						message: "Database file path:",
						initial: "./data/local",
					},
					{ onCancel },
				);
				filePath = res.path;
			}

			if (!namespace || !database) {
				const response = await prompts(
					[
						{
							type: namespace ? null : "text",
							name: "namespace",
							message: "Namespace:",
							initial: "test",
						},
						{
							type: database ? null : "text",
							name: "database",
							message: "Database:",
							initial: "test",
						},
					],
					{ onCancel },
				);
				namespace = namespace || response.namespace;
				database = database || response.database;
			}

			connectionConfig = {
				embedded: (filePath?.startsWith("surrealkv://")
					? filePath
					: `surrealkv://${filePath}`) as `surrealkv://${string}`,
				namespace,
				database,
			};
			ui.newline();
			ui.warn("Note: Embedded mode requires @surrealdb/node package");
			ui.newline();
		}

		// === Prompt for unreal folder location ===
		// Default to ./src/unreal if src/ exists, otherwise ./unreal
		const hasSrcDir = await fs
			.access(path.join(process.cwd(), "src"))
			.then(() => true)
			.catch(() => false);
		const defaultUnrealPath = hasSrcDir ? "./src/unreal" : "./unreal";

		const unrealPathResponse = await prompts(
			{
				type: "text",
				name: "path",
				message: "Where should the unreal folder be created?",
				initial: defaultUnrealPath,
			},
			{ onCancel },
		);
		const unrealPath = unrealPathResponse.path || defaultUnrealPath;

		// === Create unreal/ folder structure ===
		const unrealDir = path.resolve(process.cwd(), unrealPath);
		const tablesDir = path.join(unrealDir, "tables");

		await fs.mkdir(tablesDir, { recursive: true });
		ui.success(`Created ${unrealPath}/ folder structure`);

		// === Generate unreal.config.json at root ===
		const configJson = generateConfigJson(unrealPath);
		await fs.writeFile(
			path.join(process.cwd(), "unreal.config.json"),
			JSON.stringify(configJson, null, "\t"),
		);
		ui.success("Created unreal.config.json");

		// === Generate unreal/surreal.ts ===
		const surrealTs = generateSurrealClient(connectionMode);
		await fs.writeFile(path.join(unrealDir, "surreal.ts"), surrealTs);
		ui.success(`Created ${unrealPath}/surreal.ts`);

		// === Generate/append .env file ===
		const envContent = generateEnvContent(connectionConfig, connectionMode);
		const envPath = path.join(process.cwd(), ".env");
		const envExists = await fs
			.access(envPath)
			.then(() => true)
			.catch(() => false);

		ui.newline();
		if (envExists) {
			// Ask if user wants to append to existing .env
			const response = await prompts(
				{
					type: "confirm",
					name: "appendEnv",
					message: "Append SurrealDB config to existing .env file?",
					initial: true,
				},
				{ onCancel },
			);
			if (response.appendEnv) {
				const existingEnv = await fs.readFile(envPath, "utf-8");
				// Check if SURREAL vars already exist
				if (existingEnv.includes("SURREAL_URL")) {
					ui.warn(".env already contains SURREAL_* variables, skipping append");
				} else {
					await fs.appendFile(envPath, `\n\n${envContent}\n`);
					ui.success("Appended SurrealDB config to .env");
				}
			}
		} else {
			// Create new .env file
			const response = await prompts(
				{
					type: "confirm",
					name: "createEnv",
					message: "Create .env file with SurrealDB config?",
					initial: true,
				},
				{ onCancel },
			);
			if (response.createEnv) {
				await fs.writeFile(envPath, `${envContent}\n`);
				ui.success("Created .env file");
				ui.info("  Remember to add .env to your .gitignore!");
			}
		}

		// === Dependency Installation ===
		const detectedPkgManager = detectPackageManager();
		const deps = ["unreal-orm@latest", "surrealdb@alpha"];
		const devDeps = ["@unreal-orm/cli"];
		if (connectionMode === "memory" || connectionMode === "file") {
			deps.push("@surrealdb/node@alpha");
		}

		// Determine if we should install
		let shouldInstall = options.install;
		if (shouldInstall === undefined) {
			const allDeps = [...deps, ...devDeps.map((d) => `${d} (dev)`)];
			const { install } = await prompts(
				{
					type: "confirm",
					name: "install",
					message: `Install dependencies? (${allDeps.join(", ")})`,
					initial: true,
				},
				{ onCancel },
			);
			shouldInstall = install;
		}

		if (shouldInstall) {
			// Determine package manager
			let pkgManager: string = options.pm ?? "";
			if (!pkgManager) {
				const pmChoices = [
					{ title: "npm", value: "npm" },
					{ title: "yarn", value: "yarn" },
					{ title: "pnpm", value: "pnpm" },
					{ title: "bun", value: "bun" },
				];
				const detectedIndex = pmChoices.findIndex(
					(c) => c.value === detectedPkgManager,
				);

				const { pm } = await prompts(
					{
						type: "select",
						name: "pm",
						message: "Package manager:",
						choices: pmChoices,
						initial: detectedIndex >= 0 ? detectedIndex : 0,
					},
					{ onCancel },
				);
				pkgManager = pm ?? detectedPkgManager;
			}

			// Install production dependencies
			const cmd = getInstallCommand(pkgManager, deps, false);
			ui.newline();
			ui.info(`Running: ${cmd}...`);
			try {
				execSync(cmd, { stdio: "inherit" });
			} catch (e) {
				ui.error("Failed to install dependencies");
			}

			// Install dev dependencies (CLI)
			const devCmd = getInstallCommand(pkgManager, devDeps, true);
			ui.info(`Running: ${devCmd}...`);
			try {
				execSync(devCmd, { stdio: "inherit" });
				ui.success("Dependencies installed");
			} catch (e) {
				ui.error("Failed to install dev dependencies");
			}
		}

		// === Determine next action ===
		let action = "none";
		if (options.sample) action = "sample";
		else if (options.fromDb) action = "from-db";
		else if (options.fromSurql) action = "from-surql";
		else {
			const res = await prompts(
				{
					type: "select",
					name: "action",
					message: "What would you like to do next?",
					choices: [
						{
							title: "Generate sample tables",
							value: "sample",
							description: "User, Post, Follow tables with indexes & relations",
						},
						{
							title: "Import from Database",
							value: "from-db",
							description: "Introspect existing DB",
						},
						{
							title: "Import from .surql file",
							value: "from-surql",
							description: "Parse SurrealQL file",
						},
						{ title: "Nothing for now", value: "none" },
					],
				},
				{ onCancel },
			);
			action = res.action;
		}

		// === Execute action ===
		if (action === "sample") {
			// Copy sample tables from examples/simple
			const examplesDir = path.resolve(__dirname, "../../examples/simple");
			const sampleFiles = ["User.ts", "Post.ts", "Follow.ts"];

			for (const file of sampleFiles) {
				const content = await fs.readFile(
					path.join(examplesDir, file),
					"utf-8",
				);
				await fs.writeFile(path.join(tablesDir, file), content);
			}

			ui.success("Generated sample tables:");
			console.log(ui.dim("   • User.ts    - Basic user table with indexes"));
			console.log(
				ui.dim(
					"   • Post.ts    - Posts with record links, arrays, and methods",
				),
			);
			console.log(
				ui.dim("   • Follow.ts  - Relation table (graph edge) example"),
			);
		} else if (action === "from-db") {
			ui.info("Run 'unreal pull' to import schema from database");
		} else if (action === "from-surql") {
			ui.info("Run 'unreal pull --file <path>' to import schema");
		}

		// === Entry point integration ===
		ui.newline();
		const entryPointResponse = await prompts(
			{
				type: "confirm",
				name: "addImport",
				message: "Add import to your entry point? (e.g., index.ts, main.ts)",
				initial: true,
			},
			{ onCancel },
		);

		if (entryPointResponse.addImport) {
			// Try to detect common entry points
			const commonEntryPoints = [
				"src/index.ts",
				"src/main.ts",
				"src/app.ts",
				"index.ts",
				"main.ts",
				"app.ts",
			];

			let detectedEntry: string | null = null;
			for (const entry of commonEntryPoints) {
				const entryPath = path.join(process.cwd(), entry);
				const exists = await fs
					.access(entryPath)
					.then(() => true)
					.catch(() => false);
				if (exists) {
					detectedEntry = entry;
					break;
				}
			}

			const entryResponse = await prompts(
				{
					type: "text",
					name: "entryPoint",
					message: "Entry point file:",
					initial: detectedEntry || "src/index.ts",
				},
				{ onCancel },
			);

			const entryPoint = entryResponse.entryPoint;
			if (entryPoint) {
				const entryPath = path.join(process.cwd(), entryPoint);
				const entryExists = await fs
					.access(entryPath)
					.then(() => true)
					.catch(() => false);

				// Calculate relative import path
				const entryDir = path.dirname(entryPath);
				let relativePath = path.relative(entryDir, unrealDir);
				if (!relativePath.startsWith(".")) {
					relativePath = `./${relativePath}`;
				}
				// Normalize to forward slashes for imports
				relativePath = relativePath.replace(/\\/g, "/");
				const importLine = `// Initialize database connection and configure ORM (must be first import)
import "${relativePath}/surreal";`;

				if (entryExists) {
					// Read existing file and check if import already exists
					const content = await fs.readFile(entryPath, "utf-8");
					if (content.includes("/surreal")) {
						ui.warn("Entry point already imports surreal.ts, skipping");
					} else {
						// Add import at the top of the file
						const newContent = `${importLine}\n${content}`;
						await fs.writeFile(entryPath, newContent);
						ui.success(`Added import to ${entryPoint}`);
					}
				} else {
					// Create new entry point file
					const newContent = `${importLine}\n\n// Your app code here\nconsole.log("Hello from UnrealORM!");\n`;
					await fs.mkdir(path.dirname(entryPath), { recursive: true });
					await fs.writeFile(entryPath, newContent);
					ui.success(`Created ${entryPoint} with import`);
				}
			}
		}

		// === Final completion message ===
		ui.header("UnrealORM setup complete!", "You are ready to build!");

		console.log(ui.dim("Project structure:"));
		console.log(ui.dim("  unreal.config.json  - Path configuration"));
		console.log(ui.dim(`  ${unrealPath}/`));
		console.log(
			ui.dim("    surreal.ts        - Database connection & ORM config"),
		);
		console.log(ui.dim("    tables/           - Table definitions"));

		ui.newline();
		console.log(ui.dim("Quick start:"));
		console.log(
			ui.dim(`  1. Import "${unrealPath}/surreal" in your entry point`),
		);
		console.log(ui.dim("  2. Define tables in tables/ directory"));
		console.log(ui.dim("  3. Use models: await User.select({ limit: 10 })"));

		ui.newline();
		console.log(ui.dim("CLI commands:"));
		console.log(ui.dim("  • unreal pull  - Import schema from database"));
		console.log(ui.dim("  • unreal push  - Apply local schema to database"));
		console.log(ui.dim("  • unreal diff  - Compare schemas"));
		ui.newline();

		// Star prompt
		ui.warn(
			"⭐ If you find UnrealORM useful, please give us a star on GitHub!",
		);
		console.log(ui.dim("   https://github.com/Jimpex/unreal-orm\n"));
	});

// === Helper Functions ===

function detectPackageManager() {
	const userAgent = process.env.npm_config_user_agent;
	if (userAgent?.startsWith("bun")) return "bun";
	if (userAgent?.startsWith("pnpm")) return "pnpm";
	if (userAgent?.startsWith("yarn")) return "yarn";
	return "npm";
}

function getInstallCommand(manager: string, deps: string[], isDev: boolean) {
	const depStr = deps.join(" ");
	const devFlag = isDev ? " -D" : "";
	switch (manager) {
		case "bun":
			return `bun add${devFlag} ${depStr}`;
		case "pnpm":
			return `pnpm add${devFlag} ${depStr}`;
		case "yarn":
			return `yarn add${devFlag} ${depStr}`;
		default:
			return `npm install${isDev ? " --save-dev" : ""} ${depStr}`;
	}
}

/**
 * Generate unreal.config.json content
 */
function generateConfigJson(unrealPath: string): object {
	return {
		$schema: "./node_modules/unreal-orm/schema.json",
		path: unrealPath,
	};
}

/**
 * Generate environment variables content for .env file
 */
function generateEnvContent(config: ConnectionConfig, mode: string): string {
	const isEmbedded = mode === "memory" || mode === "file";
	const lines: string[] = ["# SurrealDB Connection (generated by UnrealORM)"];

	if (isEmbedded) {
		const embedded = "embedded" in config ? config.embedded : "mem://";
		const connectUrl = embedded === "memory" ? "mem://" : embedded;
		lines.push(`SURREAL_URL=${connectUrl}`);
		lines.push(`SURREAL_NS=${config.namespace}`);
		lines.push(`SURREAL_DB=${config.database}`);
	} else {
		const url = "url" in config ? config.url : "ws://localhost:8000";
		const auth =
			"authentication" in config &&
			config.authentication &&
			typeof config.authentication === "object"
				? config.authentication
				: null;
		const username = auth && "username" in auth ? auth.username : "";
		const password = auth && "password" in auth ? auth.password : "";

		lines.push(`SURREAL_URL=${url}`);
		lines.push(`SURREAL_NS=${config.namespace}`);
		lines.push(`SURREAL_DB=${config.database}`);
		lines.push(`SURREAL_USER=${username}`);
		lines.push(`SURREAL_PASS=${password}`);
	}

	return lines.join("\n");
}

/**
 * Generate unreal/surreal.ts content with environment variable support.
 * No hardcoded defaults - all values must come from environment variables.
 */
function generateSurrealClient(mode: string): string {
	const isEmbedded = mode === "memory" || mode === "file";

	// Mode-specific configuration
	const modeLabel = isEmbedded ? "Embedded" : "Remote";
	const urlExample = isEmbedded
		? "mem://, surrealkv://./data"
		: "ws://localhost:8000";

	// Environment variables needed
	const envVars = ["SURREAL_URL", "SURREAL_NS", "SURREAL_DB"];
	if (!isEmbedded) {
		envVars.push("SURREAL_USER", "SURREAL_PASS");
	}

	// Imports
	const imports = isEmbedded
		? `import { Unreal } from "unreal-orm";
import { createRemoteEngines, Surreal } from "surrealdb";
import { createNodeEngines } from "@surrealdb/node";`
		: `import { Unreal } from "unreal-orm";
import { Surreal } from "surrealdb";`;

	// Env var declarations
	const envDeclarations = envVars
		.map((v) => `const ${v} = process.env.${v};`)
		.join("\n");

	// Validation check
	const envCheck = envVars.join(" || !");
	const envList = envVars.join(", ");

	// Surreal instantiation
	const surrealInit = isEmbedded
		? `db = new Surreal({
		engines: {
			...createRemoteEngines(),
			...createNodeEngines(),
		},
	});`
		: "db = new Surreal();";

	// Connect options
	const connectOptions = isEmbedded
		? `{
		namespace: SURREAL_NS,
		database: SURREAL_DB,
	}`
		: `{
		namespace: SURREAL_NS,
		database: SURREAL_DB,
		authentication: {
			username: SURREAL_USER,
			password: SURREAL_PASS,
		},
	}`;

	// URL reference (embedded needs ! assertion since we validate above)
	const urlRef = isEmbedded ? "SURREAL_URL!" : "SURREAL_URL";

	return `/**
 * SurrealDB Client Configuration (${modeLabel} Mode)
 *
 * This file manages your database connection and configures the ORM.
 * Generated by UnrealORM CLI - feel free to customize.
 *
 * ## Setup
 *
 * 1. Import this file once in your app's entry point:
 *    \`\`\`ts
 *    import "./unreal/surreal";
 *    \`\`\`
 *
 * 2. Use ORM models anywhere in your app:
 *    \`\`\`ts
 *    import { User } from "./unreal/tables/User";
 *    const users = await User.select({ limit: 10 });
 *    \`\`\`
 *
 * ## Direct Database Access
 *
 * For raw queries or operations not covered by the ORM:
 * \`\`\`ts
 * import { getDatabase } from "./unreal/surreal";
 *
 * const db = await getDatabase();
 * const result = await db.query("SELECT * FROM user WHERE active = true");
 * \`\`\`
 *
 * ## Required Environment Variables
 *
${envVars.map((v) => ` * - \`${v}\`${v === "SURREAL_URL" ? ` - Connection URL (e.g., ${urlExample})` : ""}`).join("\n")}
 *
 * Note: Bun, Vite, and Next.js auto-load .env files.
 * For Node.js, use \`dotenv\` or set variables manually.
 */

${imports}

// =============================================================================
// Environment Configuration
// =============================================================================

${envDeclarations}

if (!${envCheck}) {
	throw new Error(
		"Missing required SurrealDB environment variables: ${envList}\\n" +
		"Make sure your .env file exists and contains these variables."
	);
}

// =============================================================================
// Database Connection
// =============================================================================

let db: Surreal | null = null;
let connectionPromise: Promise<Surreal> | null = null;

/**
 * Get the database instance, connecting if necessary.
 *
 * This is the recommended way to access the database for direct queries.
 * The connection is lazy-initialized on first call and cached.
 *
 * @example
 * \`\`\`ts
 * const db = await getDatabase();
 * const result = await db.query(surql\`SELECT * FROM user\`);
 * \`\`\`
 */
export async function getDatabase(): Promise<Surreal> {
	if (db) return db;
	if (connectionPromise) return connectionPromise;
	connectionPromise = connect();
	return connectionPromise;
}

/**
 * Establish the database connection.
 *
 * Prefer using \`getDatabase()\` which handles caching automatically.
 * Use this directly only if you need to force a new connection.
 */
export async function connect(): Promise<Surreal> {
	if (db) return db;

	${surrealInit}

	await db.connect(${urlRef}, ${connectOptions});

	return db;
}

/**
 * Close the database connection.
 *
 * Call this when shutting down your application gracefully.
 */
export async function close(): Promise<void> {
	if (db) {
		await db.close();
		db = null;
		connectionPromise = null;
	}
}

// =============================================================================
// ORM Configuration
// =============================================================================

// Configure the ORM to use this database connection.
// This enables implicit database usage in model methods:
//   await User.select({ limit: 10 })  // No need to pass db
Unreal.configure({ getDatabase });
`;
}

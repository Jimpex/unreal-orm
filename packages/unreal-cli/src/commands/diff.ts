import { Command } from "@commander-js/extra-typings";
import { resolveConnection } from "../utils/connect";
import { loadConfig, resolveSchemaDir } from "../utils/config";
import { introspect } from "../introspection/introspect";
import { generateCode } from "../codegen/generator";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { extractSchemaFromRuntime } from "../diff/parseTypeScript";
import { formatChanges } from "../diff/compare";
import type { SchemaAST } from "unreal-orm";
import { compareSchemas } from "unreal-orm";
import { ui } from "../utils/ui";

interface FileDiff {
	filename: string;
	databaseContent: string;
	codeContent: string;
}

interface DiffResult {
	added: string[];
	removed: string[];
	modified: FileDiff[];
	unchanged: string[];
}

/**
 * Compares generated code with existing files to detect changes (string-based, deprecated).
 * @deprecated Use semantic AST comparison instead
 */
function compareFiles(
	generatedFiles: Map<string, string>,
	outputDir: string,
): DiffResult {
	const result: DiffResult = {
		added: [],
		removed: [],
		modified: [],
		unchanged: [],
	};

	// Check for added and modified files
	for (const [filename, newContent] of generatedFiles) {
		const filepath = join(outputDir, filename);
		if (!existsSync(filepath)) {
			result.added.push(filename);
		} else {
			const existingContent = readFileSync(filepath, "utf-8");
			if (existingContent.trim() !== newContent.trim()) {
				result.modified.push({
					filename,
					databaseContent: newContent,
					codeContent: existingContent,
				});
			} else {
				result.unchanged.push(filename);
			}
		}
	}

	// Check for removed files (files that exist in code but not in DB)
	if (existsSync(outputDir)) {
		const codeFiles = readdirSync(outputDir).filter((f) => f.endsWith(".ts"));
		for (const file of codeFiles) {
			if (!generatedFiles.has(file)) {
				result.removed.push(file);
			}
		}
	}

	return result;
}

/**
 * Gets a brief summary of what changed in a file.
 */
function getChangeSummary(diff: FileDiff): string {
	const dbLines = diff.databaseContent.split("\n").length;
	const codeLines = diff.codeContent.split("\n").length;
	const lineDiff = dbLines - codeLines;

	if (lineDiff > 0) {
		return `+${lineDiff} lines`;
	}
	if (lineDiff < 0) {
		return `${lineDiff} lines`;
	}
	return "content changed";
}

/**
 * Gets a summary of schema changes.
 */
function getSummary(changes: import("../diff/compare").SchemaChange[]): {
	total: number;
	tables: number;
	fields: number;
	indexes: number;
} {
	const counts = {
		total: changes.length,
		tables: 0,
		fields: 0,
		indexes: 0,
	};

	for (const change of changes) {
		if (change.type.startsWith("table_")) counts.tables++;
		else if (change.type.startsWith("field_")) counts.fields++;
		else if (change.type.startsWith("index_")) counts.indexes++;
	}

	return counts;
}

/**
 * Displays diff results with colored output.
 */
function displayDiff(diff: DiffResult): void {
	const { added, removed, modified, unchanged } = diff;

	ui.header("Schema Diff Summary");

	if (added.length > 0) {
		console.log(ui.theme.success(`+ Added (${added.length}):`));
		for (const file of added) {
			console.log(`  + ${file}`);
		}
		ui.newline();
	}

	if (removed.length > 0) {
		console.log(ui.theme.error(`- Removed (${removed.length}):`));
		for (const file of removed) {
			console.log(`  - ${file}`);
		}
		ui.newline();
	}

	if (modified.length > 0) {
		console.log(ui.theme.warning(`~ Modified (${modified.length}):`));
		for (const fileDiff of modified) {
			console.log(`  ~ ${fileDiff.filename}`);
			console.log(
				ui.dim(`    Database: from database (${getChangeSummary(fileDiff)})`),
			);
			console.log(ui.dim("    Code:     current file"));
		}
		ui.newline();
	}

	if (unchanged.length > 0) {
		console.log(ui.theme.dim(`= Unchanged (${unchanged.length}):`));
		// Comma-separated to save space
		const fileList = unchanged.join(", ");
		console.log(ui.dim(`  ${fileList}`));
		ui.newline();
	}

	// Summary
	const hasChanges =
		added.length > 0 || removed.length > 0 || modified.length > 0;
	if (hasChanges) {
		console.log(
			ui.bold(
				`${added.length + removed.length + modified.length} file(s) changed, ${unchanged.length} unchanged`,
			),
		);
		ui.newline();
		ui.info('Run "unreal pull" to sync your code schema with the database.');
	} else {
		ui.success("Code schema is in sync with database");
	}
}

export const diffCommand = new Command()
	.name("diff")
	.description("Compare TypeScript schema with database schema")
	.option("--url <url>", "Database URL (e.g., http://localhost:8000)")
	.option("-u, --username <username>", "Database username")
	.option("-p, --password <password>", "Database password")
	.option("-n, --namespace <namespace>", "Database namespace")
	.option("-d, --database <database>", "Database name")
	.option("--auth-level <level>", "Auth level: root, namespace, or database")
	.option("-s, --schema-dir <path>", "Schema directory path")
	.option("-e, --embedded <mode>", "Use embedded mode (memory or file path)")
	.option("--detailed", "Show detailed field-level changes")
	.action(async (options) => {
		try {
			ui.header("UnrealORM Diff", "Compare code vs database schema");

			// Load config and resolve schema directory
			const unrealConfig = await loadConfig();
			const outputDir = await resolveSchemaDir({
				cliOutput: options.schemaDir,
				config: unrealConfig,
			});

			// Resolve database connection (handles CLI flags, config, or prompts)
			const db = await resolveConnection({
				cliOptions: {
					url: options.url,
					username: options.username,
					password: options.password,
					namespace: options.namespace,
					database: options.database,
					authLevel: options.authLevel,
					embedded: options.embedded,
				},
				config: unrealConfig,
				// Always prompt for config vs manual to allow diffing against external DBs
				skipAutoConfig: true,
			});

			if (!db) {
				ui.error("Failed to establish database connection.");
				process.exit(1);
			}

			// Introspect database schema
			const introspectSpinner = ui.spin("Introspecting database schema");
			const databaseSchema: SchemaAST = await introspect(db);
			introspectSpinner.succeed("Introspected database schema");

			// Extract code schema from TypeScript files
			let codeSchema: SchemaAST | null = null;
			if (existsSync(outputDir)) {
				const parseSpinner = ui.spin("Parsing code schema");
				try {
					codeSchema = await extractSchemaFromRuntime(outputDir);
					parseSpinner.succeed("Parsed code schema");
				} catch (error) {
					parseSpinner.fail("Could not parse code schema");
					ui.warn(`${error instanceof Error ? error.message : String(error)}`);
					ui.dim("Falling back to file-based comparison");
					ui.newline();
				}
			}

			// Perform semantic diff if we have code schema, otherwise fall back to file comparison
			if (codeSchema) {
				// Semantic AST-based diff
				const changes = compareSchemas(databaseSchema, codeSchema);

				if (changes.length === 0) {
					ui.success(
						"No schema differences detected. Code and database schemas are in sync.",
					);
					await db.close();
					return;
				}

				const summary = getSummary(changes);
				const formattedChanges = formatChanges(changes, options.detailed);

				ui.divider();
				ui.info("Schema Changes");
				ui.divider();
				ui.newline();
				console.log(formattedChanges);

				// Summary with color-coded counts
				const parts: string[] = [];
				if (summary.fields > 0) {
					parts.push(ui.theme.warning(`${summary.fields} field(s)`));
				}
				if (summary.indexes > 0) {
					parts.push(ui.theme.info(`${summary.indexes} index(es)`));
				}
				if (summary.tables > 0) {
					parts.push(ui.theme.primary(`${summary.tables} table(s)`));
				}

				ui.newline();
				console.log(ui.bold(`${summary.total} change(s): ${parts.join(", ")}`));

				// Show hint about detailed flag if not already using it
				if (!options.detailed && summary.total > 0) {
					ui.newline();
					ui.dim("Tip: Use --detailed flag to see old/new values for changes");
				}

				ui.newline();
				console.log(
					ui.theme.secondary("Run"),
					ui.bold("unreal pull"),
					ui.theme.secondary("or"),
					ui.bold("unreal push"),
					ui.theme.secondary("to sync your code schema with the database."),
				);
				ui.newline();
			} else {
				// Fallback: file-based string comparison
				const generatedFiles = generateCode(databaseSchema);
				const diff = compareFiles(generatedFiles, outputDir);
				displayDiff(diff);
			}

			await db.close();
		} catch (error) {
			ui.error("Error:", error);
			process.exit(1);
		}
	});

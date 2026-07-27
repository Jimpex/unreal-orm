import { Command } from "@commander-js/extra-typings";
import { resolveConnection } from "../utils/connect";
import { loadConfig, resolveSchemaDir } from "../utils/config";
import { introspect } from "../introspection/introspect";
import { existsSync } from "node:fs";
import { extractSchemaFromRuntime } from "../diff/parseTypeScript";
import { formatChanges } from "../diff/compare";
import type { SchemaAST } from "unreal-orm";
import { compareSchemas } from "unreal-orm";
import { ui } from "../utils/ui";
import { debug } from "../utils/debug";

/**
 * Gets a summary of schema changes.
 */
function getSummary(changes: import("../diff/compare").SchemaChange[]): {
	total: number;
	tables: number;
	fields: number;
	indexes: number;
	buckets: number;
} {
	const counts = {
		total: changes.length,
		tables: 0,
		fields: 0,
		indexes: 0,
		buckets: 0,
	};

	for (const change of changes) {
		if (change.type.startsWith("table_")) counts.tables++;
		else if (change.type.startsWith("field_")) counts.fields++;
		else if (change.type.startsWith("index_")) counts.indexes++;
		else if (change.type.startsWith("bucket_")) counts.buckets++;
	}

	return counts;
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
	.option(
		"--log-level <level>",
		"Log output level: silent, normal, debug",
		"normal",
	)
	.action(async (options) => {
		try {
			ui.header("UnrealORM Diff", "Compare code vs database schema");

			// Load config and resolve schema directory
			debug("Loading config");
			const unrealConfig = await loadConfig();
			const outputDir = await resolveSchemaDir({
				cliOutput: options.schemaDir,
				config: unrealConfig,
			});

			// Resolve database connection (handles CLI flags, config, or prompts)
			debug("Resolving database connection");
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
			debug("Introspecting database schema");
			const introspectSpinner = ui.spin("Introspecting database schema");
			const databaseSchema: SchemaAST = await introspect(db);
			introspectSpinner.succeed("Introspected database schema");

			// Parse code schema
			debug("Parsing code schema");
			if (!existsSync(outputDir)) {
				ui.error(`Schema directory not found: ${outputDir}`);
				ui.info("Run 'unreal pull' first to generate schema files.");
				await db.close();
				process.exit(1);
			}

			const parseSpinner = ui.spin("Parsing code schema");
			let codeSchema: SchemaAST;
			try {
				codeSchema = await extractSchemaFromRuntime(outputDir);
				parseSpinner.succeed("Parsed code schema");
			} catch (error) {
				parseSpinner.fail("Could not parse code schema");
				ui.error(error instanceof Error ? error.message : String(error));
				await db.close();
				process.exit(1);
			}

			// Semantic AST-based diff (code -> database, push perspective)
			debug("Comparing schemas");
			const changes = compareSchemas(codeSchema, databaseSchema, true);

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
			ui.info("Schema Changes (code → database)");
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
			if (summary.buckets > 0) {
				parts.push(ui.theme.secondary(`${summary.buckets} bucket(s)`));
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
				ui.bold("unreal push"),
				ui.theme.secondary("to apply these changes to the database,"),
				ui.theme.secondary("or"),
				ui.bold("unreal pull"),
				ui.theme.secondary("to overwrite your code schema with the database state."),
			);
			ui.newline();

			await db.close();
		} catch (error) {
			ui.error("Error:", error);
			process.exit(1);
		}
	});

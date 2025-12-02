import { Command } from "@commander-js/extra-typings";
import { existsSync } from "node:fs";
import { resolveConnection } from "../utils/connect";
import { introspect } from "../introspection/introspect";
import { displayWarnings, clearWarnings } from "../introspection/warnings";
import { loadConfig, resolveSchemaDir } from "../utils/config";
import { promptFileReview } from "../utils/prompts";
import type { SchemaAST, SchemaChange } from "unreal-orm";
import { compareSchemas } from "unreal-orm";
import { extractSchemaFromRuntime } from "../diff/parseTypeScript";
import { generateSqlForChange } from "../diff/generateMigration";
import { ui } from "../utils/ui";

export const pushCommand = new Command()
	.name("push")
	.description("Apply TypeScript schema to database")
	.option("--url <url>", "Database URL (e.g., http://localhost:8000)")
	.option("-u, --username <username>", "Database username")
	.option("-p, --password <password>", "Database password")
	.option("-n, --namespace <namespace>", "Database namespace")
	.option("-d, --database <database>", "Database name")
	.option("--auth-level <level>", "Auth level: root, namespace, or database")
	.option("-s, --schema-dir <path>", "Schema directory path")
	.option("--embedded <mode>", "Use embedded mode (memory or file path)")
	.option("-y, --yes", "Skip confirmation prompt")
	// .option("--detailed", "Show detailed diff with old/new values")
	.action(async (options) => {
		ui.header("UnrealORM Push", "Apply code schema to database");
		clearWarnings();

		// Load config and resolve schema directory
		const unrealConfig = await loadConfig();
		const schemaDir = await resolveSchemaDir({
			cliOutput: options.schemaDir,
			config: unrealConfig,
		});

		// Check if schema directory exists
		if (!existsSync(schemaDir)) {
			ui.error(`Schema directory not found: ${schemaDir}`);
			ui.info("Run 'unreal pull' first to generate schema files.");
			ui.newline();
			process.exit(1);
		}

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
			// Always prompt for config vs manual to allow pushing to external DBs
			skipAutoConfig: true,
		});

		if (!db) {
			ui.error("Failed to establish database connection.");
			process.exit(1);
		}

		// Extract code schema
		let spinner = ui.spin("Loading code schema...");
		let codeSchema: SchemaAST;
		try {
			codeSchema = await extractSchemaFromRuntime(schemaDir);
			spinner.succeed(
				`Loaded ${codeSchema.tables.length} table(s) from ${schemaDir}`,
			);
		} catch (error) {
			spinner.fail("Failed to load code schema");
			ui.error(error instanceof Error ? error.message : String(error));
			process.exit(1);
		}

		// Introspect database schema
		spinner = ui.spin("Introspecting database schema...");
		let databaseSchema: SchemaAST;
		try {
			databaseSchema = await introspect(db);
			spinner.succeed(
				`Found ${databaseSchema.tables.length} table(s) in database`,
			);
		} catch (error) {
			spinner.fail("Failed to introspect database");
			ui.error(error instanceof Error ? error.message : String(error));
			await db.close();
			process.exit(1);
		}

		// Compare schemas (code -> database, isPush=true for correct wording)
		spinner.start("Comparing schemas...");
		const changes = compareSchemas(codeSchema, databaseSchema, true);
		spinner.succeed("Comparison complete");

		if (changes.length === 0) {
			ui.success("Schemas are identical. Nothing to push.");
			await db.close();
			displayWarnings();
			process.exit(0);
		}

		// Summarize changes by type
		const addCount = changes.filter((c) => c.type.includes("added")).length;
		const removeCount = changes.filter((c) =>
			c.type.includes("removed"),
		).length;
		const modifyCount = changes.length - addCount - removeCount;

		ui.divider();
		ui.info("CHANGE SUMMARY (Code -> Database)");
		ui.divider();
		ui.newline();
		ui.printer.log(`  Total changes: ${ui.bold(String(changes.length))}`);
		if (addCount > 0)
			ui.printer.log(`  ${ui.theme.success("+")} Additions: ${addCount}`);
		if (removeCount > 0)
			ui.printer.log(`  ${ui.theme.error("-")} Removals: ${removeCount}`);
		if (modifyCount > 0)
			ui.printer.log(
				`  ${ui.theme.warning("~")} Modifications: ${modifyCount}`,
			);
		ui.newline();

		// List all changes
		for (const change of changes) {
			const icon = change.type.includes("added")
				? ui.theme.success("+")
				: change.type.includes("removed")
					? ui.theme.error("-")
					: ui.theme.warning("~");
			ui.printer.log(`  ${icon} ${change.description}`);
		}
		ui.newline();

		// Interactive change-by-change review (unless --yes flag)
		const changesToApply: SchemaChange[] = [];
		if (!options.yes) {
			let applyAll = false;

			// Print header once
			ui.divider();
			ui.info("CHANGE REVIEW");
			ui.divider();
			ui.newline();

			for (let i = 0; i < changes.length; i++) {
				const change = changes[i];
				if (!change) continue;

				if (applyAll) {
					changesToApply.push(change);
					continue;
				}

				// Clear previous change review
				ui.printer.clear();

				// Show change info with appropriate action label
				const changeType = change.type.includes("added")
					? ui.theme.success("ADD")
					: change.type.includes("removed")
						? ui.theme.error("REMOVE")
						: ui.theme.warning("MODIFY");

				ui.printer.log(
					ui.bold(
						`[${i + 1}/${changes.length}] ${changeType}: ${change.description}`,
					),
				);

				// Generate and show SQL
				const sql = generateSqlForChange(change, codeSchema, databaseSchema);
				if (sql) {
					ui.printer.log(ui.dim("\n📝 SurrealQL Statement:"));
					ui.printer.log(ui.theme.secondary(`  ${sql}\n`));
				} else {
					ui.printer.log(
						ui.dim("\n⚠️  No SurrealQL generated for this change\n"),
					);
				}

				// Prompt for action
				const action = await promptFileReview(
					"this change",
					i + 1,
					changes.length,
				);

				if (action === "cancel") {
					ui.newline();
					ui.warn("Operation cancelled.");
					await db.close();
					process.exit(0);
				}

				if (action === "all") {
					applyAll = true;
					changesToApply.push(change);
					// Add all remaining changes
					for (let j = i + 1; j < changes.length; j++) {
						const remainingChange = changes[j];
						if (remainingChange) {
							changesToApply.push(remainingChange);
						}
					}
					break;
				}

				if (action === "yes") {
					changesToApply.push(change);
				}

				// action === "no" means skip this change
			}

			// Clear the last change review
			ui.printer.clear();

			if (changesToApply.length === 0) {
				ui.warn("No changes selected. Operation cancelled.");
				await db.close();
				process.exit(0);
			}

			ui.divider();
			ui.success("APPLYING SELECTED CHANGES");
			ui.divider();
			ui.info(
				`Will apply ${changesToApply.length} of ${changes.length} change(s)`,
			);
			ui.newline();
		} else {
			// --yes flag: apply all changes
			ui.divider();
			ui.success("APPLYING ALL CHANGES (--yes flag)");
			ui.divider();
			ui.info(`Applying all ${changes.length} change(s)`);
			ui.newline();
			changesToApply.push(...changes);
		}

		// Generate SQL for selected changes
		const sqlStatements: string[] = [];
		for (const change of changesToApply) {
			const sql = generateSqlForChange(change, codeSchema, databaseSchema);
			if (sql) {
				sqlStatements.push(sql);
			}
		}

		// Apply migration
		spinner.start("Applying schema changes...");
		try {
			// Flatten multi-line statements and join with semicolons
			const allStatements = sqlStatements
				.flatMap((sql) => sql.split("\n").filter((line) => line.trim()))
				.join("");
			await db.query(`BEGIN;${allStatements}COMMIT;`);
			spinner.succeed("Schema changes applied successfully");
		} catch (error) {
			spinner.fail("Failed to apply schema changes");
			ui.error(error instanceof Error ? error.message : String(error));
			await db.close();
			process.exit(1);
		}

		// Close connection
		await db.close();

		// Display warnings
		displayWarnings();

		ui.header("Schema push complete!");
		ui.dim(
			`Applied ${changesToApply.length} of ${changes.length} change(s) to database`,
		);
		ui.newline();
	});

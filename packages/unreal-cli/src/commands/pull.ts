import { Command } from "@commander-js/extra-typings";
import {
	existsSync,
	mkdirSync,
	writeFileSync,
	readFileSync,
	readdirSync,
	unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { resolveConnection } from "../utils/connect";
import { introspect } from "../introspection/introspect";
import { displayWarnings, clearWarnings } from "../introspection/warnings";
import { loadConfig, resolveSchemaDir } from "../utils/config";
import { promptFileReview } from "../utils/prompts";
import type { SchemaAST } from "../introspection/types";
import { planFileChanges, type FileChange } from "../codegen/fileMerger";
import { extractSchemaFromRuntime } from "../diff/parseTypeScript";
import { getFileDiff, getChangeSummary } from "../utils/diffViewer";
import { ui } from "../utils/ui";

export const pullCommand = new Command()
	.name("pull")
	.description("Introspect database and generate TypeScript schema")
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
		ui.header("UnrealORM Pull", "Introspect database and generate schema");
		clearWarnings();

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
			// Always prompt for config vs manual to allow pulling from external DBs
			skipAutoConfig: true,
		});

		if (!db) {
			ui.error("Failed to establish database connection.");
			process.exit(1);
		}

		// Introspect schema
		const spinner = ui.spin("Introspecting database schema...");
		let schema: SchemaAST;
		try {
			schema = await introspect(db);
			spinner.succeed(`Found ${schema.tables.length} table(s)`);
		} catch (error) {
			spinner.fail("Failed to introspect database");
			ui.error(error instanceof Error ? error.message : String(error));
			await db.close();
			process.exit(1);
		}

		// Read existing files
		spinner.start("Planning file changes...");
		const existingFiles = new Map<string, string>();
		if (existsSync(outputDir)) {
			try {
				const files = readdirSync(outputDir).filter((f) => f.endsWith(".ts"));
				for (const file of files) {
					const content = readFileSync(join(outputDir, file), "utf-8");
					existingFiles.set(file, content);
				}
			} catch (error) {
				// Directory might not exist or be readable, that's okay
			}
		}

		// Try to extract code schema for semantic comparison
		let codeSchema: SchemaAST | undefined;
		if (existsSync(outputDir)) {
			try {
				codeSchema = await extractSchemaFromRuntime(outputDir);
			} catch {
				// Failed to parse code schema, will fall back to string comparison
			}
		}

		// Plan file changes (uses semantic comparison if codeSchema available)
		let fileChanges: FileChange[];
		try {
			fileChanges = planFileChanges(schema, existingFiles, codeSchema);
			spinner.succeed("File changes planned");
		} catch (error) {
			spinner.fail("Failed to plan file changes");
			ui.error(error instanceof Error ? error.message : String(error));
			await db.close();
			process.exit(1);
		}

		// Show file changes and confirm
		if (fileChanges.length === 0) {
			ui.success("All files are up to date!");
			await db.close();
			displayWarnings();
			process.exit(0);
		}

		// Summarize changes by type
		const createCount = fileChanges.filter((c) => c.type === "create").length;
		const deleteCount = fileChanges.filter((c) => c.type === "delete").length;
		const updateCount = fileChanges.filter((c) => c.type === "update").length;

		ui.divider();
		ui.info("FILE CHANGE SUMMARY (Database -> Code)");
		ui.divider();
		ui.newline();
		ui.printer.log(`  Total files: ${ui.bold(String(fileChanges.length))}`);
		if (createCount > 0)
			ui.printer.log(`  ${ui.theme.success("+")} New files: ${createCount}`);
		if (deleteCount > 0)
			ui.printer.log(`  ${ui.theme.error("-")} Deleted files: ${deleteCount}`);
		if (updateCount > 0)
			ui.printer.log(
				`  ${ui.theme.warning("~")} Updated files: ${updateCount}`,
			);
		ui.newline();

		// List all changes
		for (const change of fileChanges) {
			const icon =
				change.type === "create"
					? ui.theme.success("+")
					: change.type === "delete"
						? ui.theme.error("-")
						: ui.theme.warning("~");
			ui.printer.log(`  ${icon} ${change.filename}`);
		}
		ui.newline();

		// Interactive file-by-file review (unless --yes flag)
		const filesToApply: FileChange[] = [];
		if (!options.yes) {
			let applyAll = false;

			// Print header once
			ui.divider();
			ui.info("FILE REVIEW");
			ui.divider();
			ui.newline();

			for (const change of fileChanges) {
				if (!change) continue; // TypeScript safety

				if (applyAll) {
					filesToApply.push(change);
					continue;
				}

				// Clear previous file review output (if any)
				ui.printer.clear();

				// Show file info
				const typeLabel =
					change.type === "create"
						? ui.theme.success("CREATE")
						: change.type === "delete"
							? ui.theme.error("DELETE")
							: ui.theme.warning("UPDATE");

				ui.printer.log(
					ui.bold(
						`[${fileChanges.indexOf(change) + 1}/${fileChanges.length}] ${typeLabel}: ${change.filename}`,
					),
				);
				ui.printer.log(
					ui.dim(`  ${getChangeSummary(change.oldContent, change.newContent)}`),
				);

				// Show diff by default
				ui.printer.log(
					getFileDiff(change.filename, change.oldContent, change.newContent),
				);

				// Prompt for action
				const action = await promptFileReview(
					change.filename,
					fileChanges.indexOf(change) + 1,
					fileChanges.length,
				);

				if (action === "cancel") {
					ui.newline();
					ui.warn("Operation cancelled.");
					await db.close();
					process.exit(0);
				}

				if (action === "all") {
					applyAll = true;
					filesToApply.push(change);
					// Add all remaining files
					for (const remainingChange of fileChanges.slice(
						fileChanges.indexOf(change) + 1,
					)) {
						if (remainingChange) {
							filesToApply.push(remainingChange);
						}
					}
					break;
				}

				if (action === "yes") {
					filesToApply.push(change);
				}

				// action === "no" means skip this file
			}

			// Clear the last file review
			ui.printer.clear();

			if (filesToApply.length === 0) {
				ui.warn("No files selected. Operation cancelled.");
				await db.close();
				process.exit(0);
			}

			ui.divider();
			ui.success("APPLYING SELECTED CHANGES");
			ui.divider();
			ui.info(
				`Will apply ${filesToApply.length} of ${fileChanges.length} file changes`,
			);
			ui.newline();
		} else {
			// --yes flag: apply all changes
			ui.divider();
			ui.success("APPLYING ALL CHANGES (--yes flag)");
			ui.divider();
			ui.info(`Applying all ${fileChanges.length} file changes`);
			ui.newline();
			filesToApply.push(...fileChanges);
		}

		// Apply file changes
		spinner.start("Applying file changes...");
		try {
			if (!existsSync(outputDir)) {
				mkdirSync(outputDir, { recursive: true });
			}

			for (const change of filesToApply) {
				const filePath = join(outputDir, change.filename);

				if (change.type === "delete") {
					unlinkSync(filePath);
				} else {
					writeFileSync(filePath, change.newContent, "utf-8");
				}
			}

			spinner.succeed(
				`Applied ${filesToApply.length} file change(s) to ${outputDir}`,
			);
		} catch (error) {
			spinner.fail("Failed to apply file changes");
			ui.error(error instanceof Error ? error.message : String(error));
			await db.close();
			process.exit(1);
		}

		// Close connection
		await db.close();

		// Display warnings
		displayWarnings();

		ui.header("Schema pull complete!");
		ui.dim("Changes applied:");
		for (const change of filesToApply) {
			const icon =
				change.type === "create" ? "+" : change.type === "delete" ? "-" : "~";
			console.log(ui.dim(`  ${icon} ${change.filename}`));
		}
		ui.newline();
	});

import type { SchemaAST, TableAST } from "../introspection/types";
import { generateCode } from "./generator";
import { compareSchemas } from "../diff/compare";
import { smartMergeTableCode } from "./smartMerge";
import chalk from "chalk";

/**
 * Represents a file change operation
 */
export interface FileChange {
	filename: string;
	type: "create" | "update" | "delete";
	oldContent?: string;
	newContent: string;
	/** For updates: what was added/removed (for display) */
	addedFields?: string[];
	addedIndexes?: string[];
	removedFields?: string[];
	removedIndexes?: string[];
}

/**
 * Compares existing files with new schema and determines what changes to make.
 *
 * When codeSchema is provided:
 * 1. Uses semantic comparison to determine if there are actual schema differences
 * 2. For updates, uses smart merge to preserve user code while adding new schema elements
 */
export function planFileChanges(
	dbSchema: SchemaAST,
	existingFiles: Map<string, string>,
	codeSchema?: SchemaAST,
): FileChange[] {
	const changes: FileChange[] = [];
	const newFiles = generateCode(dbSchema);

	// If we have code schema, do semantic comparison first
	// to determine which tables actually have differences
	const tablesWithChanges = new Set<string>();
	const schemaChanges = codeSchema ? compareSchemas(dbSchema, codeSchema) : [];
	for (const change of schemaChanges) {
		tablesWithChanges.add(change.table);
	}

	// Check for new or updated files
	for (const [filename, newContent] of newFiles) {
		const oldContent = existingFiles.get(filename);
		// Extract table name from filename (e.g., "User.ts" -> "user")
		const tableName = filename.replace(".ts", "").toLowerCase();

		if (!oldContent) {
			// New file - use generated content
			changes.push({
				filename,
				type: "create",
				newContent,
			});
		} else if (oldContent !== newContent) {
			// Content differs - check if semantically different
			if (codeSchema) {
				// Only include if there are actual schema changes for this table
				if (tablesWithChanges.has(tableName)) {
					// Use smart merge to preserve user code
					const dbTable = dbSchema.tables.find((t) => t.name === tableName);
					const codeTable = codeSchema.tables.find((t) => t.name === tableName);

					if (dbTable && codeTable) {
						const mergeResult = smartMergeTableCode(
							oldContent,
							dbTable,
							codeTable,
						);
						changes.push({
							filename,
							type: "update",
							oldContent,
							newContent: mergeResult.content,
							addedFields: mergeResult.addedFields,
							addedIndexes: mergeResult.addedIndexes,
							removedFields: mergeResult.removedFields,
							removedIndexes: mergeResult.removedIndexes,
						});
					} else {
						// Fallback to full replacement if tables not found
						changes.push({
							filename,
							type: "update",
							oldContent,
							newContent,
						});
					}
				}
				// Otherwise skip - schemas are semantically identical
			} else {
				// No code schema available, fall back to full replacement
				changes.push({
					filename,
					type: "update",
					oldContent,
					newContent,
				});
			}
		}
		// If content is identical, no change needed
	}

	// Check for deleted files (tables that no longer exist)
	for (const filename of existingFiles.keys()) {
		if (!newFiles.has(filename)) {
			changes.push({
				filename,
				type: "delete",
				oldContent: existingFiles.get(filename),
				newContent: "", // Empty for deletions
			});
		}
	}

	return changes;
}

/**
 * Formats file changes for display to the user
 */
export function formatFileChanges(changes: FileChange[]): string {
	if (changes.length === 0) {
		return "No file changes needed.";
	}

	const lines: string[] = [];

	const creates = changes.filter((c) => c.type === "create");
	const updates = changes.filter((c) => c.type === "update");
	const deletes = changes.filter((c) => c.type === "delete");

	if (creates.length > 0) {
		lines.push(chalk.bold(`\n📄 Files to create (${creates.length}):`));
		for (const change of creates) {
			lines.push(chalk.green(`  + ${change.filename}`));
		}
	}

	if (updates.length > 0) {
		lines.push(chalk.bold(`\n📝 Files to update (${updates.length}):`));
		for (const change of updates) {
			lines.push(chalk.yellow(`  ~ ${change.filename}`));
		}
	}

	if (deletes.length > 0) {
		lines.push(chalk.bold(`\n🗑️  Files to delete (${deletes.length}):`));
		for (const change of deletes) {
			lines.push(chalk.red(`  - ${change.filename}`));
		}
	}

	return lines.join("\n");
}

/**
 * Gets a summary count of file changes
 */
export function getFileChangeSummary(changes: FileChange[]): {
	created: number;
	updated: number;
	deleted: number;
	total: number;
} {
	return {
		created: changes.filter((c) => c.type === "create").length,
		updated: changes.filter((c) => c.type === "update").length,
		deleted: changes.filter((c) => c.type === "delete").length,
		total: changes.length,
	};
}

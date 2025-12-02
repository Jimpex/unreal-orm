/**
 * Runtime schema extraction from TypeScript files.
 *
 * This module provides CLI-specific functionality to import TypeScript model files
 * and extract SchemaAST using jiti. The actual extraction logic is provided by
 * the ORM's SchemaAST module.
 *
 * @module
 */

import {
	type SchemaAST,
	type TableAST,
	type IndexAST,
	extractTableFromModel,
	extractIndexFromDefinition,
	isModelClass,
	isIndexDefinition,
} from "unreal-orm";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createJiti } from "jiti";

// Re-export types for CLI consumers
export type { SchemaAST, TableAST, IndexAST };

// Create a jiti instance for importing TypeScript files
const jiti = createJiti(import.meta.url, {
	// Enable TypeScript support
	interopDefault: true,
});

/**
 * Extracts SchemaAST from runtime model classes by importing TypeScript files.
 *
 * This is a CLI-specific wrapper that uses jiti to dynamically import
 * TypeScript files from a directory. The extraction logic is provided
 * by the ORM's SchemaAST module.
 *
 * @param outputDir - Directory containing TypeScript model files
 * @returns Complete SchemaAST from all model files
 */
export async function extractSchemaFromRuntime(
	outputDir: string,
): Promise<SchemaAST> {
	const tables: TableAST[] = [];

	for (const file of readdirSync(outputDir).filter((f) => f.endsWith(".ts"))) {
		const filePath = resolve(join(outputDir, file));

		try {
			// Use jiti to import TypeScript files
			const module = await jiti.import(filePath);

			// Find exported model classes and indexes
			const tableMap = new Map<string, TableAST>();
			const indexes: { index: IndexAST; tableName: string }[] = [];

			for (const [, exportValue] of Object.entries(
				module as Record<string, unknown>,
			)) {
				// Check if it's a model class (has _tableName)
				if (isModelClass(exportValue)) {
					const tableAST = extractTableFromModel(exportValue);
					tableMap.set(tableAST.name, tableAST);
				}
				// Check if it's an index definition
				else if (isIndexDefinition(exportValue)) {
					const { index, tableName } = extractIndexFromDefinition(exportValue);
					indexes.push({ index, tableName });
				}
			}

			// Associate indexes with their tables
			for (const { index, tableName } of indexes) {
				const table = tableMap.get(tableName);
				if (table) {
					table.indexes.push(index);
				}
			}

			// Add all tables to the result
			tables.push(...tableMap.values());
		} catch (error) {
			console.warn(`Failed to import ${file}:`, error);
			// Skip files that can't be imported
		}
	}

	return { tables };
}

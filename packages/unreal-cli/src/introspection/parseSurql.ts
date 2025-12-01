import { promises as fs } from "node:fs";
import type { SchemaAST, TableAST } from "./types";
import {
	parseTableDefinition,
	parseFieldDefinition,
	parseIndexDefinition,
} from "./parser";

/** Default empty permissions */
const emptyPermissions = {};

/** Create a default table structure */
function createDefaultTable(name: string): TableAST {
	return {
		name,
		type: "NORMAL",
		schemafull: true,
		drop: false,
		permissions: emptyPermissions,
		fields: [],
		indexes: [],
		events: [],
	};
}

/**
 * Parse a .surql file containing DEFINE statements into a SchemaAST.
 * This allows generating diagrams/diffs from raw SurrealQL schema files.
 */
export async function parseSurqlFile(filePath: string): Promise<SchemaAST> {
	const content = await fs.readFile(filePath, "utf-8");
	return parseSurqlContent(content);
}

/**
 * Parse SurrealQL content string into a SchemaAST.
 */
export function parseSurqlContent(content: string): SchemaAST {
	const tables = new Map<string, TableAST>();

	// Split by semicolons and process each statement
	const statements = content
		.split(";")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);

	for (const stmt of statements) {
		// Normalize whitespace for matching
		const normalized = stmt.replace(/\s+/g, " ").trim();

		if (normalized.toUpperCase().startsWith("DEFINE TABLE")) {
			const tableDef = parseTableDefinition(stmt);
			if (tableDef.name) {
				tables.set(tableDef.name, {
					name: tableDef.name,
					type: tableDef.type ?? "NORMAL",
					schemafull: tableDef.schemafull ?? true,
					drop: tableDef.drop ?? false,
					permissions: tableDef.permissions ?? emptyPermissions,
					viewQuery: tableDef.viewQuery,
					fields: [],
					indexes: [],
					events: [],
				});
			}
		} else if (normalized.toUpperCase().startsWith("DEFINE FIELD")) {
			const fieldDef = parseFieldDefinition(stmt);
			// Extract table name from "DEFINE FIELD name ON [TABLE] tablename"
			const tableMatch = stmt.match(/ON\s+(?:TABLE\s+)?(\w+)/i);
			if (tableMatch?.[1]) {
				const tableName = tableMatch[1];
				let table = tables.get(tableName);
				if (!table) {
					// Create table if not yet defined (fields can come before table def)
					table = createDefaultTable(tableName);
					tables.set(tableName, table);
				}
				table.fields.push(fieldDef);
			}
		} else if (normalized.toUpperCase().startsWith("DEFINE INDEX")) {
			const indexDef = parseIndexDefinition(stmt);
			// Extract table name from "DEFINE INDEX name ON [TABLE] tablename"
			const tableMatch = stmt.match(/ON\s+(?:TABLE\s+)?(\w+)/i);
			if (tableMatch?.[1]) {
				const tableName = tableMatch[1];
				let table = tables.get(tableName);
				if (!table) {
					// Create table if not yet defined
					table = createDefaultTable(tableName);
					tables.set(tableName, table);
				}
				table.indexes.push(indexDef);
			}
		}
		// Skip other statements (DEFINE ANALYZER, DEFINE FUNCTION, etc.)
	}

	return {
		tables: Array.from(tables.values()),
	};
}

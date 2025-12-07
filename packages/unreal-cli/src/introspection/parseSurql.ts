import { promises as fs } from "node:fs";
import type { SchemaAST, TableAST } from "unreal-orm";
import {
	parseTableDefinition,
	parseFieldDefinition,
	parseIndexDefinition,
} from "unreal-orm";
import { addWarning } from "./warnings";

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
 * Strips SQL comments from a string.
 * Handles both single-line (--) and multi-line comments.
 */
function stripComments(content: string): string {
	// Remove single-line comments (-- to end of line)
	let result = content.replace(/--.*$/gm, "");
	// Remove multi-line comments (/* ... */)
	result = result.replace(/\/\*[\s\S]*?\*\//g, "");
	return result;
}

/**
 * Parse SurrealQL content string into a SchemaAST.
 */
export function parseSurqlContent(content: string): SchemaAST {
	const tables = new Map<string, TableAST>();

	// Strip comments and split by semicolons
	const cleanContent = stripComments(content);
	const statements = cleanContent
		.split(";")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);

	for (const stmt of statements) {
		// Normalize whitespace for matching
		const normalized = stmt.replace(/\s+/g, " ").trim();
		const upperNormalized = normalized.toUpperCase();

		try {
			if (upperNormalized.startsWith("DEFINE TABLE")) {
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
				} else {
					addWarning(
						"DEFINE TABLE",
						"Could not extract table name",
						`Statement: ${stmt.slice(0, 80)}...`,
					);
				}
			} else if (upperNormalized.startsWith("DEFINE FIELD")) {
				const fieldDef = parseFieldDefinition(stmt);
				// Extract table name from "DEFINE FIELD name ON [TABLE] tablename"
				const tableMatch = stmt.match(/\bON\s+(?:TABLE\s+)?(\w+)/i);
				if (tableMatch?.[1]) {
					const tableName = tableMatch[1];
					let table = tables.get(tableName);
					if (!table) {
						// Create table if not yet defined (fields can come before table def)
						table = createDefaultTable(tableName);
						tables.set(tableName, table);
					}
					table.fields.push(fieldDef);
				} else {
					addWarning(
						"DEFINE FIELD",
						"Could not extract table name from field definition",
						`Statement: ${stmt.slice(0, 80)}...`,
					);
				}
			} else if (upperNormalized.startsWith("DEFINE INDEX")) {
				const indexDef = parseIndexDefinition(stmt);
				// Extract table name from "DEFINE INDEX name ON [TABLE] tablename"
				const tableMatch = stmt.match(/\bON\s+(?:TABLE\s+)?(\w+)/i);
				if (tableMatch?.[1]) {
					const tableName = tableMatch[1];
					let table = tables.get(tableName);
					if (!table) {
						// Create table if not yet defined
						table = createDefaultTable(tableName);
						tables.set(tableName, table);
					}
					table.indexes.push(indexDef);
				} else {
					addWarning(
						"DEFINE INDEX",
						"Could not extract table name from index definition",
						`Statement: ${stmt.slice(0, 80)}...`,
					);
				}
			} else if (upperNormalized.startsWith("DEFINE EVENT")) {
				addWarning(
					"DEFINE EVENT",
					"Events are not yet supported",
					"Event definitions will be skipped",
				);
			} else if (upperNormalized.startsWith("DEFINE ANALYZER")) {
				// Analyzers are used by search indexes, skip silently
			} else if (upperNormalized.startsWith("DEFINE FUNCTION")) {
				addWarning(
					"DEFINE FUNCTION",
					"Custom functions are not yet supported",
					"Function definitions will be skipped",
				);
			} else if (upperNormalized.startsWith("DEFINE PARAM")) {
				addWarning(
					"DEFINE PARAM",
					"Database parameters are not yet supported",
					"Parameter definitions will be skipped",
				);
			} else if (upperNormalized.startsWith("DEFINE USER")) {
				// User definitions are DB admin, skip silently
			} else if (upperNormalized.startsWith("DEFINE ACCESS")) {
				// Access definitions are auth config, skip silently
			} else if (upperNormalized.startsWith("OPTION")) {
				// OPTION statements (like OPTION IMPORT) are skipped
			}
			// Other statements are silently skipped
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			addWarning(
				"Parse error",
				message,
				`Statement: ${stmt.slice(0, 80)}${stmt.length > 80 ? "..." : ""}`,
			);
		}
	}

	return {
		tables: Array.from(tables.values()),
	};
}

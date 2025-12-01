import type {
	FieldAST,
	IndexAST,
	TableAST,
	PermissionsAST,
	TableType,
} from "./types";
import {
	extractMatch,
	extractPermissions,
	extractRequiredMatch,
	hasKeyword,
} from "./parseHelpers";

/**
 * Parses a `DEFINE TABLE` statement.
 */
export function parseTableDefinition(ql: string): Partial<TableAST> {
	// Remove "DEFINE TABLE " prefix and split by whitespace
	const parts = ql
		.replace(/^DEFINE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/, "")
		.trim();
	const nameMatch = parts.match(/^(\w+)/);
	if (!nameMatch || !nameMatch[1])
		throw new Error(`Could not parse table name from: ${ql}`);
	const name: string = nameMatch[1];

	const type = ql.includes("TYPE RELATION")
		? "RELATION"
		: ql.includes("AS SELECT")
			? "VIEW"
			: "NORMAL";

	const schemafull = !ql.includes("SCHEMALESS");
	const drop = ql.includes("DROP");

	// Extract View Query
	let viewQuery: string | undefined;
	if (type === "VIEW") {
		const match = ql.match(/AS\s+SELECT\s+(.*?)(\s+PERMISSIONS|$)/i);
		if (match) viewQuery = `SELECT ${match[1]}`;
	}

	// Extract Permissions
	const permissions = parsePermissions(ql);

	return {
		name,
		type,
		drop,
		schemafull,
		viewQuery,
		permissions,
	};
}

/**
 * Parses a `DEFINE FIELD` statement.
 */
export function parseFieldDefinition(ql: string): FieldAST {
	// Format: DEFINE FIELD name ON [TABLE] table TYPE type ...
	// Support wildcards: field.* and array notation field[*] for nested schemas
	const nameMatch = ql.match(
		/DEFINE\s+FIELD\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:OVERWRITE\s+)?([\w.*[\]]+)\s+ON\s+(?:TABLE\s+)?[\w.]+/i,
	);
	if (!nameMatch || !nameMatch[1])
		throw new Error(`Could not parse field name from: ${ql}`);
	const name: string = nameMatch[1];

	// Extract TYPE - must come after ON clause, capture until next keyword
	// Match: ON <table> TYPE <type> [DEFAULT|VALUE|ASSERT|...]
	const typeMatch = ql.match(
		/\bON\s+(?:TABLE\s+)?[\w.]+\s+TYPE\s+(.*?)(?=\s+(?:DEFAULT|VALUE|ASSERT|PERMISSIONS|COMMENT|$))/i,
	);
	let type = "any";
	if (typeMatch?.[1]) {
		type = typeMatch[1].trim();
	}

	const flex = ql.includes("FLEXIBLE");

	// Extract DEFAULT
	const defaultMatch = ql.match(
		/\sDEFAULT\s+(.*?)(?=\s+(?:VALUE|ASSERT|PERMISSIONS|COMMENT|$))/i,
	);
	const defaultValue = defaultMatch?.[1] ? defaultMatch[1].trim() : undefined;

	// Extract VALUE
	const valueMatch = ql.match(
		/\sVALUE\s+(.*?)(?=\s+(?:ASSERT|PERMISSIONS|COMMENT|$))/i,
	);
	const value = valueMatch?.[1] ? valueMatch[1].trim() : undefined;

	// Extract ASSERT
	const assertMatch = ql.match(
		/\sASSERT\s+(.*?)(?=\s+(?:PERMISSIONS|COMMENT|$))/i,
	);
	const assert = assertMatch?.[1] ? assertMatch[1].trim() : undefined;

	const permissions = parsePermissions(ql);

	return {
		name,
		type: type || "any",
		flex,
		default: defaultValue,
		value,
		assert,
		permissions,
	};
}

/**
 * Parses a `DEFINE INDEX` statement.
 */
export function parseIndexDefinition(ql: string): IndexAST {
	// Format: DEFINE INDEX name ON [TABLE] table COLUMNS col1, col2 UNIQUE
	const nameMatch = ql.match(
		/DEFINE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+ON\s+(?:TABLE\s+)?\w+/i,
	);
	if (!nameMatch || !nameMatch[1])
		throw new Error(`Could not parse index name from: ${ql}`);
	const name: string = nameMatch[1];

	// Support both FIELDS and COLUMNS keywords
	const columnsMatch = ql.match(
		/\s(?:FIELDS|COLUMNS)\s+(.*?)(?:\s+(?:UNIQUE|SEARCH|MTREE|HNSW|COMMENT)|$)/i,
	);
	const columns = columnsMatch?.[1]
		? columnsMatch[1].split(",").map((c) => c.trim())
		: [];

	const unique = ql.includes(" UNIQUE");
	const search = ql.includes(" SEARCH ANALYZER");
	// const vector = ... (not supported in this MVP parser yet)

	return {
		name: name || "unknown_index",
		columns,
		unique,
		search,
	};
}

/**
 * Helper to parse PERMISSIONS clauses.
 */
function parsePermissions(ql: string): PermissionsAST {
	const permsMatch = ql.match(/\sPERMISSIONS\s+(.*?)(\s+COMMENT|$)/i);
	if (!permsMatch || !permsMatch[1]) return {};

	const permsStr = permsMatch[1];
	const result: PermissionsAST = {};

	// Matches: FOR select, update WHERE ...
	// This is tricky because the WHERE clause can contain anything.
	// We'll try to split by " FOR ".

	// Simplistic parser: find "FOR select <expr>"
	// This is brittle. A real parser would be better, but for now:
	const ops = ["select", "create", "update", "delete"];
	for (const op of ops) {
		// Regex looks for "FOR op expr" until the next "FOR" or end of string
		const regex = new RegExp(
			`FOR\\s+${op}\\s+(.*?)(?=\\s*,?\\s*FOR\\s+|$)`,
			"i",
		);
		const match = permsStr.match(regex);
		if (match?.[1]) {
			result[op as keyof PermissionsAST] = match[1].trim();
		}
	}

	// Handle "FULL" or "NONE" shorthand if needed?
	// SurrealDB usually outputs explicit FOR ... clauses in INFO output.

	return result;
}

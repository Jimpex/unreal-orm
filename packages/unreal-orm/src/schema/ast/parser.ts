/**
 * SurrealQL Parser - Converts DEFINE statements to SchemaAST.
 *
 * This module parses SurrealQL DEFINE statements (TABLE, FIELD, INDEX)
 * into the intermediate AST representation.
 *
 * @module
 */

import type { FieldAST, IndexAST, TableAST, PermissionsAST } from "./types";

// ============================================================================
// PARSE HELPERS
// ============================================================================

/**
 * Safely extracts a regex match group with null checking.
 */
function extractMatch(
	text: string,
	pattern: RegExp,
	groupIndex = 1,
): string | undefined {
	const match = text.match(pattern);
	return match?.[groupIndex];
}

/**
 * Checks if a DEFINE statement contains a specific keyword.
 */
function hasKeyword(ql: string, keyword: string): boolean {
	const pattern = new RegExp(`\\b${keyword}\\b`, "i");
	return pattern.test(ql);
}

// ============================================================================
// PERMISSIONS PARSING
// ============================================================================

/**
 * Parses PERMISSIONS clauses from a DEFINE statement.
 */
function parsePermissions(ql: string): PermissionsAST {
	const permsMatch = ql.match(/\sPERMISSIONS\s+(.*?)(\s+COMMENT|$)/i);
	if (!permsMatch || !permsMatch[1]) return {};

	const permsStr = permsMatch[1];
	const result: PermissionsAST = {};

	// Handle shorthand: PERMISSIONS FULL/NONE
	if (permsStr.match(/^\s*(FULL|NONE)\s*$/i)) {
		const value = permsStr.trim();
		return { select: value, create: value, update: value, delete: value };
	}

	// Matches: FOR select, update WHERE ...
	const ops = ["select", "create", "update", "delete"] as const;
	for (const op of ops) {
		// Regex looks for "FOR op expr" until the next "FOR" or end of string
		const regex = new RegExp(
			`FOR\\s+${op}\\s+(.*?)(?=\\s*,?\\s*FOR\\s+|$)`,
			"i",
		);
		const match = permsStr.match(regex);
		if (match?.[1]) {
			result[op] = match[1].trim();
		}
	}

	return result;
}

// ============================================================================
// TABLE PARSING
// ============================================================================

/**
 * Parses a `DEFINE TABLE` statement into a partial TableAST.
 *
 * @param ql - The raw SurrealQL DEFINE TABLE statement
 * @returns Partial TableAST (fields, indexes, events are populated separately)
 *
 * @example
 * ```ts
 * const table = parseTableDefinition("DEFINE TABLE user SCHEMAFULL");
 * // { name: "user", type: "NORMAL", schemafull: true, ... }
 * ```
 */
export function parseTableDefinition(ql: string): Partial<TableAST> {
	// Remove "DEFINE TABLE " prefix and extract name
	const parts = ql
		.replace(/^DEFINE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:OVERWRITE\s+)?/, "")
		.trim();
	const nameMatch = parts.match(/^(\w+)/);
	if (!nameMatch || !nameMatch[1]) {
		throw new Error(`Could not parse table name from: ${ql}`);
	}
	const name: string = nameMatch[1];

	// Determine table type
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

// ============================================================================
// FIELD PARSING
// ============================================================================

/**
 * Parses a `DEFINE FIELD` statement into a FieldAST.
 *
 * @param ql - The raw SurrealQL DEFINE FIELD statement
 * @returns Complete FieldAST
 *
 * @example
 * ```ts
 * const field = parseFieldDefinition("DEFINE FIELD email ON TABLE user TYPE string");
 * // { name: "email", type: "string", flex: false, ... }
 * ```
 */
export function parseFieldDefinition(ql: string): FieldAST {
	// Format: DEFINE FIELD name ON [TABLE] table TYPE type ...
	// Support wildcards: field.* and array notation field[*] for nested schemas
	const nameMatch = ql.match(
		/DEFINE\s+FIELD\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:OVERWRITE\s+)?([\w.*[\]]+)\s+ON\s+(?:TABLE\s+)?[\w.]+/i,
	);
	if (!nameMatch || !nameMatch[1]) {
		throw new Error(`Could not parse field name from: ${ql}`);
	}
	const name: string = nameMatch[1];

	// Extract TYPE - must come after ON clause, capture until next keyword
	const typeMatch = ql.match(
		/\bON\s+(?:TABLE\s+)?[\w.]+\s+TYPE\s+(.*?)(?=\s+(?:DEFAULT|VALUE|ASSERT|PERMISSIONS|COMMENT|READONLY|$))/i,
	);
	let type = "any";
	if (typeMatch?.[1]) {
		type = typeMatch[1].trim();
	}

	const flex = hasKeyword(ql, "FLEXIBLE");

	// Extract DEFAULT
	const defaultMatch = ql.match(
		/\sDEFAULT\s+(.*?)(?=\s+(?:VALUE|ASSERT|PERMISSIONS|COMMENT|READONLY|$))/i,
	);
	const defaultValue = defaultMatch?.[1] ? defaultMatch[1].trim() : undefined;

	// Extract VALUE
	const valueMatch = ql.match(
		/\sVALUE\s+(.*?)(?=\s+(?:ASSERT|PERMISSIONS|COMMENT|READONLY|$))/i,
	);
	const value = valueMatch?.[1] ? valueMatch[1].trim() : undefined;

	// Extract ASSERT
	const assertMatch = ql.match(
		/\sASSERT\s+(.*?)(?=\s+(?:PERMISSIONS|COMMENT|READONLY|$))/i,
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

// ============================================================================
// INDEX PARSING
// ============================================================================

/**
 * Parses a `DEFINE INDEX` statement into an IndexAST.
 *
 * @param ql - The raw SurrealQL DEFINE INDEX statement
 * @returns Complete IndexAST
 *
 * @example
 * ```ts
 * const index = parseIndexDefinition("DEFINE INDEX email_idx ON TABLE user FIELDS email UNIQUE");
 * // { name: "email_idx", columns: ["email"], unique: true }
 * ```
 */
export function parseIndexDefinition(ql: string): IndexAST {
	// Format: DEFINE INDEX name ON [TABLE] table COLUMNS col1, col2 UNIQUE
	const nameMatch = ql.match(
		/DEFINE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:OVERWRITE\s+)?(\w+)\s+ON\s+(?:TABLE\s+)?\w+/i,
	);
	if (!nameMatch || !nameMatch[1]) {
		throw new Error(`Could not parse index name from: ${ql}`);
	}
	const name: string = nameMatch[1];

	// Support both FIELDS and COLUMNS keywords
	const columnsMatch = ql.match(
		/\s(?:FIELDS|COLUMNS)\s+(.*?)(?:\s+(?:UNIQUE|SEARCH|MTREE|HNSW|COMMENT)|$)/i,
	);
	const columns = columnsMatch?.[1]
		? columnsMatch[1].split(",").map((c) => c.trim())
		: [];

	const unique = hasKeyword(ql, "UNIQUE");
	const search = ql.includes("SEARCH ANALYZER");

	return {
		name: name || "unknown_index",
		columns,
		unique,
		search,
	};
}

/**
 * Extracts the table name from a DEFINE FIELD or DEFINE INDEX statement.
 *
 * @param ql - The raw SurrealQL statement
 * @returns The table name or undefined
 */
export function extractTableName(ql: string): string | undefined {
	const match = ql.match(/\sON\s+(?:TABLE\s+)?(\w+)/i);
	return match?.[1];
}

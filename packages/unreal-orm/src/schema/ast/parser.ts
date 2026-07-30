/**
 * SurrealQL Parser - Converts DEFINE statements to SchemaAST.
 *
 * This module parses SurrealQL DEFINE statements (TABLE, FIELD, INDEX)
 * into the intermediate AST representation.
 *
 * @module
 */

import type {
	BucketAST,
	FieldAST,
	IndexAST,
	PermissionsAST,
	TableAST,
} from "./types";

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
	// Support backtick-escaped names like `value` for reserved words
	const nameMatch = ql.match(
		/DEFINE\s+FIELD\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:OVERWRITE\s+)?(`[^`]+`|[\w.*[\]]+)\s+ON\s+(?:TABLE\s+)?[\w.]+/i,
	);
	if (!nameMatch || !nameMatch[1]) {
		throw new Error(`Could not parse field name from: ${ql}`);
	}
	// Remove backticks from escaped names
	const name: string = nameMatch[1].replace(/^`|`$/g, "");

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

	// Extract READONLY
	const readonly = /\bREADONLY\b/i.test(ql);

	const permissions = parsePermissions(ql);

	return {
		name,
		type: type || "any",
		flex,
		default: defaultValue,
		value,
		assert,
		readonly,
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
	// Format: DEFINE INDEX name ON [TABLE] table [FIELDS|COLUMNS col1, col2] [UNIQUE|COUNT|FULLTEXT ANALYZER ...]
	const nameMatch = ql.match(
		/DEFINE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:OVERWRITE\s+)?(\w+)\s+ON\s+(?:TABLE\s+)?\w+/i,
	);
	if (!nameMatch || !nameMatch[1]) {
		throw new Error(`Could not parse index name from: ${ql}`);
	}
	const name: string = nameMatch[1];

	// Support both FIELDS and COLUMNS keywords
	const columnsMatch = ql.match(
		/\s(?:FIELDS|COLUMNS)\s+(.*?)(?:\s+(?:UNIQUE|FULLTEXT|SEARCH|COUNT|COMMENT|CONCURRENTLY|DEFER|HNSW|MTREE|DISKANN)|$)/i,
	);
	const columns = columnsMatch?.[1]
		? columnsMatch[1].split(",").map((c) => c.trim())
		: [];

	const unique = hasKeyword(ql, "UNIQUE");
	const count = hasKeyword(ql, "COUNT");
	const concurrently = hasKeyword(ql, "CONCURRENTLY");
	const defer = hasKeyword(ql, "DEFER");

	// Full-text search: supports both "SEARCH ANALYZER" (pre-3.0) and "FULLTEXT ANALYZER" (3.0+)
	const ftsMatch = ql.match(/(?:SEARCH|FULLTEXT)\s+ANALYZER\s+(\w+)/i);
	const search = ql.includes("SEARCH ANALYZER") || ql.includes("FULLTEXT");
	const analyzer = ftsMatch?.[1];
	const bm25 = hasKeyword(ql, "BM25");
	const highlights = hasKeyword(ql, "HIGHLIGHTS");

	// Vector indexes: MTREE, HNSW, DISKANN
	let vectorType: "MTREE" | "HNSW" | "DISKANN" | undefined;
	let vectorDimension: number | undefined;
	let vectorDistance: string | undefined;
	let vectorElementType: string | undefined;
	let vectorEfc: number | undefined;
	let vectorM: number | undefined;
	let vectorM0: number | undefined;
	let vectorLm: number | undefined;
	let vectorDegree: number | undefined;
	let vectorLBuild: number | undefined;
	let vectorAlpha: number | undefined;
	let vectorHashedVector: boolean | undefined;

	const vectorMatch = ql.match(/\b(MTREE|HNSW|DISKANN)\b/i);
	if (vectorMatch?.[1]) {
		vectorType = vectorMatch[1].toUpperCase() as "MTREE" | "HNSW" | "DISKANN";

		const dimMatch = ql.match(/\bDIMENSION\s+(\d+)/i);
		if (dimMatch?.[1]) vectorDimension = Number(dimMatch[1]);

		const typeMatch = ql.match(/\bTYPE\s+(F64|F32|F16|I64|I32|I16|I8|U8)/i);
		if (typeMatch?.[1]) vectorElementType = typeMatch[1].toUpperCase();

		const distMatch = ql.match(
			/\bDIST\s+(EUCLIDEAN|COSINE|MANHATTAN|INNER_PRODUCT|COSINE_NORMALIZED|HAMMING)/i,
		);
		if (distMatch?.[1]) vectorDistance = distMatch[1].toUpperCase();

		if (vectorType === "HNSW") {
			const efcMatch = ql.match(/\bEFC\s+(\d+)/i);
			if (efcMatch?.[1]) vectorEfc = Number(efcMatch[1]);
			const mMatch = ql.match(/\bM\s+(\d+)/i);
			if (mMatch?.[1]) vectorM = Number(mMatch[1]);
			const m0Match = ql.match(/\bM0\s+(\d+)/i);
			if (m0Match?.[1]) vectorM0 = Number(m0Match[1]);
			const lmMatch = ql.match(/\bLM\s+([\d.]+f?)/i);
			if (lmMatch?.[1]) vectorLm = Number(lmMatch[1].replace(/f$/, ""));
		} else if (vectorType === "DISKANN") {
			const degreeMatch = ql.match(/\bDEGREE\s+(\d+)/i);
			if (degreeMatch?.[1]) vectorDegree = Number(degreeMatch[1]);
			const lBuildMatch = ql.match(/\bL_BUILD\s+(\d+)/i);
			if (lBuildMatch?.[1]) vectorLBuild = Number(lBuildMatch[1]);
			const alphaMatch = ql.match(/\bALPHA\s+([\d.]+)/i);
			if (alphaMatch?.[1]) vectorAlpha = Number(alphaMatch[1]);
			vectorHashedVector = hasKeyword(ql, "HASHED_VECTOR");
		}
	}

	return {
		name: name || "unknown_index",
		columns,
		unique,
		count: count || undefined,
		concurrently: concurrently || undefined,
		defer: defer || undefined,
		search: search || undefined,
		analyzer,
		bm25: bm25 || undefined,
		highlights: highlights || undefined,
		vectorType,
		vectorDimension,
		vectorDistance,
		vectorElementType,
		vectorEfc,
		vectorM,
		vectorM0,
		vectorLm,
		vectorDegree,
		vectorLBuild,
		vectorAlpha,
		vectorHashedVector: vectorHashedVector || undefined,
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

// ============================================================================
// BUCKET PARSING
// ============================================================================

/**
 * Parses a `DEFINE BUCKET` statement into a BucketAST.
 *
 * @param ql - The raw SurrealQL DEFINE BUCKET statement
 * @returns Complete BucketAST
 *
 * @example
 * ```ts
 * const bucket = parseBucketDefinition("DEFINE BUCKET avatars BACKEND 'memory'");
 * // { name: "avatars", backend: "memory" }
 * ```
 */
export function parseBucketDefinition(ql: string): BucketAST {
	// Extract bucket name
	const nameMatch = ql.match(
		/DEFINE\s+BUCKET\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:OVERWRITE\s+)?(\w+)/i,
	);
	if (!nameMatch || !nameMatch[1]) {
		throw new Error(`Could not parse bucket name from: ${ql}`);
	}
	const name: string = nameMatch[1];

	// Extract BACKEND value (single-quoted or double-quoted string)
	const backendMatch = ql.match(/\bBACKEND\s+['"]([^'"]+)['"]/i);
	const backend = backendMatch?.[1];

	// Detect READONLY flag
	const readonly = /\bREADONLY\b/i.test(ql);

	// Extract PERMISSIONS expression (everything after PERMISSIONS until COMMENT or end)
	const permMatch = ql.match(/\bPERMISSIONS\s+(.+?)\s*(?:COMMENT\s+|$)/i);
	const permissions = permMatch?.[1] ? permMatch[1].trim() : undefined;

	// Extract COMMENT value
	const commentMatch = ql.match(/\bCOMMENT\s+['"]([^'"]+)['"]/i);
	const comment = commentMatch?.[1] ?? undefined;

	const result: BucketAST = { name };
	if (backend !== undefined) result.backend = backend;
	if (readonly) result.readonly = true;
	if (permissions !== undefined) result.permissions = permissions;
	if (comment !== undefined) result.comment = comment;

	return result;
}

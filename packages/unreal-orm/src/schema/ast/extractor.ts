/**
 * Runtime Model Extractor - Converts ORM model classes to SchemaAST.
 *
 * This module extracts schema information from runtime model classes
 * and index definitions, producing the intermediate AST representation.
 *
 * @module
 */

import type {
	SchemaAST,
	TableAST,
	FieldAST,
	IndexAST,
	PermissionsAST,
} from "./types";
import type { AnyModelClass } from "../../define/table/types/model";
import type { FieldDefinition } from "../../define/field/types";
import type { IndexDefinition } from "../../define/index/types";
import type { Definable } from "../../define/types";

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if a value is a model class.
 */
export function isModelClass(value: unknown): value is AnyModelClass {
	return (
		typeof value === "function" &&
		"_tableName" in value &&
		"_options" in value &&
		"_fields" in value
	);
}

/**
 * Type guard to check if a value is an index definition.
 */
export function isIndexDefinition(value: unknown): value is IndexDefinition {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const obj = value as Record<string, unknown>;
	return (
		obj._type === "index" &&
		typeof obj.name === "string" &&
		"table" in obj &&
		Array.isArray(obj.fields)
	);
}

// ============================================================================
// FIELD EXTRACTION
// ============================================================================

/**
 * Recursively enumerates all subfields of a field definition.
 * Handles nested objects and arrays, producing flattened paths.
 *
 * @internal
 */
function enumerateSubfields(
	fieldDef: FieldDefinition<unknown>,
	basePath = "",
): Array<{ path: string; fieldDef: FieldDefinition<unknown> }> {
	const results: Array<{ path: string; fieldDef: FieldDefinition<unknown> }> =
		[];
	const path = basePath;
	results.push({ path, fieldDef });

	// Handle array of objects/arrays recursively
	if (fieldDef.type.startsWith("array<") && fieldDef.arrayElementType) {
		const arrPath = path ? `${path}[*]` : "[*]";
		results.push(...enumerateSubfields(fieldDef.arrayElementType, arrPath));
	}

	// Handle option<object> and similar wrappers
	if (
		(fieldDef.type === "object" ||
			(fieldDef.type.startsWith("option<") && fieldDef.objectSchema)) &&
		fieldDef.objectSchema
	) {
		for (const [subKey, subDef] of Object.entries(fieldDef.objectSchema)) {
			const objPath = path ? `${path}.${subKey}` : subKey;
			results.push(...enumerateSubfields(subDef, objPath));
		}
	}

	return results;
}

/**
 * Converts a value to string, handling BoundQuery objects from surql templates.
 * @internal
 */
function valueToString(value: unknown): string | undefined {
	if (!value) return undefined;

	// Handle BoundQuery objects from surql`` templates
	if (typeof value === "object" && value !== null && "query" in value) {
		return (value as { query: string }).query;
	}

	return String(value);
}

/**
 * Extracts permissions from various permission formats.
 * @internal
 */
function extractPermissions(perms: unknown): PermissionsAST {
	if (!perms) return {};

	// Handle object format
	if (typeof perms === "object" && perms !== null) {
		const result: PermissionsAST = {};
		const permObj = perms as Record<string, unknown>;

		if (permObj.select) result.select = valueToString(permObj.select);
		if (permObj.create) result.create = valueToString(permObj.create);
		if (permObj.update) result.update = valueToString(permObj.update);
		if (permObj.delete) result.delete = valueToString(permObj.delete);

		return result;
	}

	return {};
}

/**
 * Extracts a FieldAST from a runtime field definition.
 * @internal
 */
function extractFieldFromDefinition(
	name: string,
	fieldDef: FieldDefinition<unknown>,
): FieldAST {
	const field: FieldAST = {
		name,
		type: fieldDef.type,
		flex: fieldDef.flexible ?? false,
		default: valueToString(fieldDef.default),
		value: valueToString(fieldDef.value),
		assert: valueToString(fieldDef.assert),
		permissions: extractPermissions(fieldDef.permissions),
	};

	// Add optional properties only if they exist
	if (fieldDef.readonly) field.readonly = true;
	if (fieldDef.reference) field.reference = true;
	if (fieldDef.recordOnDelete) {
		field.onDelete = fieldDef.recordOnDelete as FieldAST["onDelete"];
	}
	if (fieldDef.comment) field.comment = fieldDef.comment;

	return field;
}

/**
 * Extracts all fields from a model class, flattening nested objects.
 * @internal
 */
function extractFieldsFromModel(modelClass: AnyModelClass): FieldAST[] {
	const fields: FieldAST[] = [];

	// Check if _fields exists and is an object
	if (!modelClass._fields || typeof modelClass._fields !== "object") {
		return [];
	}

	for (const [fieldName, fieldDef] of Object.entries(modelClass._fields)) {
		// Enumerate all subfields (flattened with dot notation)
		const subfields = enumerateSubfields(
			fieldDef as FieldDefinition<unknown>,
			fieldName,
		);

		for (const { path, fieldDef: subDef } of subfields) {
			// Skip wildcard type constraints (they're not real fields)
			// - .* for object wildcards
			// - [*] for array element type constraints
			if (path.endsWith(".*") || /\[\*\]$/.test(path)) continue;

			const fieldAST = extractFieldFromDefinition(path, subDef);
			fields.push(fieldAST);
		}
	}

	return fields;
}

// ============================================================================
// TABLE EXTRACTION
// ============================================================================

/**
 * Extracts a TableAST from a runtime model class.
 *
 * @param modelClass - The model class to extract from
 * @returns Complete TableAST (indexes populated separately)
 *
 * @example
 * ```ts
 * const tableAST = extractTableFromModel(User);
 * // { name: "user", type: "NORMAL", fields: [...], ... }
 * ```
 */
export function extractTableFromModel(modelClass: AnyModelClass): TableAST {
	const options = modelClass._options;

	// Extract fields
	const fields = extractFieldsFromModel(modelClass);

	return {
		name: modelClass._tableName,
		type:
			(options.type?.toUpperCase() as "NORMAL" | "RELATION" | "VIEW") ||
			"NORMAL",
		drop: false,
		schemafull: options.schemafull,
		viewQuery:
			options.type === "view" && options.as
				? valueToString(options.as)
				: undefined,
		permissions: extractPermissions(options.permissions),
		fields,
		indexes: [], // Indexes are populated separately
		events: [], // Not currently supported
	};
}

// ============================================================================
// INDEX EXTRACTION
// ============================================================================

/**
 * Extracts an IndexAST from a runtime index definition.
 *
 * @param indexDef - The index definition to extract from
 * @returns Object containing the IndexAST and associated table name
 *
 * @example
 * ```ts
 * const { index, tableName } = extractIndexFromDefinition(emailIndex);
 * // { index: { name: "email_idx", columns: ["email"], unique: true }, tableName: "user" }
 * ```
 */
export function extractIndexFromDefinition(indexDef: IndexDefinition): {
	index: IndexAST;
	tableName: string;
} {
	const index: IndexAST = {
		name: indexDef.name,
		columns: indexDef.fields,
		unique: indexDef.unique ?? false,
	};

	// Add optional properties only if they exist
	if (indexDef.analyzer) {
		index.search = true;
		index.analyzer = indexDef.analyzer;
	}
	if (indexDef.comment) index.comment = indexDef.comment;

	return {
		index,
		tableName: indexDef.table._tableName,
	};
}

// ============================================================================
// SCHEMA EXTRACTION
// ============================================================================

/**
 * Extracts a complete SchemaAST from an array of definables (models and indexes).
 *
 * @param definables - Array of model classes and index definitions
 * @returns Complete SchemaAST
 *
 * @example
 * ```ts
 * import { User, Post, emailIndex } from "./tables";
 *
 * const schema = extractSchemaFromDefinables([User, Post, emailIndex]);
 * // { tables: [{ name: "user", ... }, { name: "post", ... }] }
 * ```
 */
export function extractSchemaFromDefinables(
	definables: Definable[],
): SchemaAST {
	const tableMap = new Map<string, TableAST>();
	const indexes: { index: IndexAST; tableName: string }[] = [];

	for (const definable of definables) {
		if (isModelClass(definable)) {
			const tableAST = extractTableFromModel(definable);
			tableMap.set(tableAST.name, tableAST);
		} else if (isIndexDefinition(definable)) {
			const { index, tableName } = extractIndexFromDefinition(definable);
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

	return { tables: Array.from(tableMap.values()) };
}

/**
 * Schema Comparison - Semantic diffing between SchemaAST objects.
 *
 * This module compares two schemas and produces structured change lists,
 * enabling migration generation and schema validation.
 *
 * @module
 */

import type { SchemaAST, TableAST, FieldAST, IndexAST } from "./types";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Types of schema changes that can be detected.
 */
export type ChangeType =
	| "table_added"
	| "table_removed"
	| "table_type_changed"
	| "field_added"
	| "field_removed"
	| "field_type_changed"
	| "field_default_changed"
	| "field_value_changed"
	| "field_assertion_changed"
	| "index_added"
	| "index_removed"
	| "index_modified";

/**
 * Represents a single schema change between source and target.
 */
export interface SchemaChange {
	/** Type of change */
	type: ChangeType;
	/** Table name affected */
	table: string;
	/** Field name (for field changes) */
	field?: string;
	/** Index name (for index changes) */
	index?: string;
	/** Previous value (for modifications/removals) */
	oldValue?: unknown;
	/** New value (for additions/modifications) */
	newValue?: unknown;
	/** Human-readable description */
	description: string;
}

// ============================================================================
// NORMALIZATION HELPERS
// ============================================================================

/**
 * Normalizes a type string for comparison.
 * Converts option<T> to none | T for semantic equivalence.
 */
function normalizeType(type: string): string {
	// Convert option<T> to none | T
	const optionMatch = type.match(/^option<(.+)>$/);
	if (optionMatch) {
		return `none | ${optionMatch[1]}`;
	}
	return type;
}

/**
 * Normalizes a field name for comparison.
 * Converts [*] to .* for semantic equivalence (array type constraints).
 */
function normalizeFieldName(name: string): string {
	// Convert array wildcard notation [*] to .*
	return name.replace(/\[\*\]/g, ".*");
}

// ============================================================================
// FIELD COMPARISON
// ============================================================================

function compareFields(
	tableName: string,
	sourceTable: TableAST,
	targetTable: TableAST,
	isPush: boolean,
): SchemaChange[] {
	const changes: SchemaChange[] = [];
	const sourceFields = new Map(
		sourceTable.fields.map((f) => [normalizeFieldName(f.name), f]),
	);
	const targetFields = new Map(
		targetTable.fields.map((f) => [normalizeFieldName(f.name), f]),
	);

	// Check for added fields (exist in source but not target)
	for (const [fieldName, sourceField] of sourceFields) {
		const targetField = targetFields.get(fieldName);

		if (!targetField) {
			changes.push({
				type: "field_added",
				table: tableName,
				field: fieldName,
				newValue: sourceField.type,
				description: isPush
					? `Field '${fieldName}' (${sourceField.type}) exists in code but not in database`
					: `Field '${fieldName}' (${sourceField.type}) exists in database but not in code`,
			});
			continue;
		}

		// Compare field type (normalize option<T> vs none | T)
		const normalizedSourceType = normalizeType(sourceField.type);
		const normalizedTargetType = normalizeType(targetField.type);

		if (normalizedSourceType !== normalizedTargetType) {
			changes.push({
				type: "field_type_changed",
				table: tableName,
				field: fieldName,
				oldValue: targetField.type,
				newValue: sourceField.type,
				description: `Field '${fieldName}' type changed from ${targetField.type} to ${sourceField.type}`,
			});
		}

		// Compare default value
		if (sourceField.default !== targetField.default) {
			changes.push({
				type: "field_default_changed",
				table: tableName,
				field: fieldName,
				oldValue: targetField.default,
				newValue: sourceField.default,
				description: `Field '${fieldName}' default changed`,
			});
		}

		// Compare value expression
		if (sourceField.value !== targetField.value) {
			changes.push({
				type: "field_value_changed",
				table: tableName,
				field: fieldName,
				oldValue: targetField.value,
				newValue: sourceField.value,
				description: `Field '${fieldName}' value expression changed`,
			});
		}

		// Compare assertion
		if (sourceField.assert !== targetField.assert) {
			changes.push({
				type: "field_assertion_changed",
				table: tableName,
				field: fieldName,
				oldValue: targetField.assert,
				newValue: sourceField.assert,
				description: `Field '${fieldName}' assertion changed`,
			});
		}
	}

	// Check for removed fields (exist in target but not source)
	for (const [fieldName, targetField] of targetFields) {
		if (!sourceFields.has(fieldName)) {
			changes.push({
				type: "field_removed",
				table: tableName,
				field: fieldName,
				oldValue: targetField.type,
				description: isPush
					? `Field '${fieldName}' exists in database but not in code`
					: `Field '${fieldName}' exists in code but not in database`,
			});
		}
	}

	return changes;
}

// ============================================================================
// INDEX COMPARISON
// ============================================================================

function compareIndexes(
	tableName: string,
	sourceTable: TableAST,
	targetTable: TableAST,
	isPush: boolean,
): SchemaChange[] {
	const changes: SchemaChange[] = [];
	const sourceIndexes = new Map(sourceTable.indexes.map((i) => [i.name, i]));
	const targetIndexes = new Map(targetTable.indexes.map((i) => [i.name, i]));

	// Check for added indexes (exist in source but not target)
	for (const [indexName, sourceIndex] of sourceIndexes) {
		const targetIndex = targetIndexes.get(indexName);

		if (!targetIndex) {
			changes.push({
				type: "index_added",
				table: tableName,
				index: indexName,
				newValue: sourceIndex.columns,
				description: isPush
					? `Index '${indexName}' on [${sourceIndex.columns.join(", ")}] exists in code but not in database`
					: `Index '${indexName}' on [${sourceIndex.columns.join(", ")}] exists in database but not in code`,
			});
			continue;
		}

		// Compare index definition
		const columnsChanged =
			JSON.stringify(sourceIndex.columns) !==
			JSON.stringify(targetIndex.columns);
		const uniqueChanged = sourceIndex.unique !== targetIndex.unique;

		if (columnsChanged || uniqueChanged) {
			changes.push({
				type: "index_modified",
				table: tableName,
				index: indexName,
				oldValue: targetIndex,
				newValue: sourceIndex,
				description: `Index '${indexName}' definition changed`,
			});
		}
	}

	// Check for removed indexes (exist in target but not source)
	for (const [indexName, targetIndex] of targetIndexes) {
		if (!sourceIndexes.has(indexName)) {
			changes.push({
				type: "index_removed",
				table: tableName,
				index: indexName,
				oldValue: targetIndex.columns,
				description: isPush
					? `Index '${indexName}' exists in database but not in code`
					: `Index '${indexName}' exists in code but not in database`,
			});
		}
	}

	return changes;
}

// ============================================================================
// MAIN COMPARISON
// ============================================================================

/**
 * Compares two SchemaAST objects and returns structured changes.
 * This enables semantic diffing instead of string comparison.
 *
 * @param source - The "source of truth" schema (what we want to apply)
 * @param target - The "target" schema (what currently exists)
 * @param isPush - If true, source=code, target=database (pushing code to DB)
 *                 If false, source=database, target=code (pulling DB to code)
 * @returns Array of schema changes
 *
 * @example
 * ```ts
 * const codeSchema = extractSchemaFromDefinables([User, Post]);
 * const dbSchema = await introspectDatabase(db);
 *
 * // Find what needs to change in DB to match code
 * const changes = compareSchemas(codeSchema, dbSchema, true);
 *
 * // Find what needs to change in code to match DB
 * const changes = compareSchemas(dbSchema, codeSchema, false);
 * ```
 */
export function compareSchemas(
	source: SchemaAST,
	target: SchemaAST,
	isPush = false,
): SchemaChange[] {
	const changes: SchemaChange[] = [];

	// Create lookup maps
	const sourceTables = new Map(source.tables.map((t) => [t.name, t]));
	const targetTables = new Map(target.tables.map((t) => [t.name, t]));

	// Check for added tables (exist in source but not target)
	for (const [tableName, sourceTable] of sourceTables) {
		const targetTable = targetTables.get(tableName);

		if (!targetTable) {
			// Count fields and indexes for detailed description
			const fieldCount = sourceTable.fields.length;
			const indexCount = sourceTable.indexes.length;
			const details: string[] = [];
			if (fieldCount > 0)
				details.push(`${fieldCount} field${fieldCount !== 1 ? "s" : ""}`);
			if (indexCount > 0)
				details.push(`${indexCount} index${indexCount !== 1 ? "es" : ""}`);
			const detailStr = details.length > 0 ? ` (${details.join(", ")})` : "";

			changes.push({
				type: "table_added",
				table: tableName,
				description: isPush
					? `Table '${tableName}' will be created${detailStr}`
					: `Table '${tableName}' will be added${detailStr}`,
			});
			continue;
		}

		// Compare table type
		if (sourceTable.type !== targetTable.type) {
			changes.push({
				type: "table_type_changed",
				table: tableName,
				oldValue: targetTable.type,
				newValue: sourceTable.type,
				description: `Table '${tableName}' type changed from ${targetTable.type} to ${sourceTable.type}`,
			});
		}

		// Compare fields
		const fieldChanges = compareFields(
			tableName,
			sourceTable,
			targetTable,
			isPush,
		);
		changes.push(...fieldChanges);

		// Compare indexes
		const indexChanges = compareIndexes(
			tableName,
			sourceTable,
			targetTable,
			isPush,
		);
		changes.push(...indexChanges);
	}

	// Check for removed tables (exist in target but not source)
	for (const [tableName, targetTable] of targetTables) {
		if (!sourceTables.has(tableName)) {
			// Count fields and indexes for detailed description
			const fieldCount = targetTable.fields.length;
			const indexCount = targetTable.indexes.length;
			const details: string[] = [];
			if (fieldCount > 0)
				details.push(`${fieldCount} field${fieldCount !== 1 ? "s" : ""}`);
			if (indexCount > 0)
				details.push(`${indexCount} index${indexCount !== 1 ? "es" : ""}`);
			const detailStr = details.length > 0 ? ` (${details.join(", ")})` : "";

			changes.push({
				type: "table_removed",
				table: tableName,
				description: isPush
					? `Table '${tableName}' will be dropped${detailStr}`
					: `Table '${tableName}' will be removed${detailStr}`,
			});
		}
	}

	return changes;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Checks if two schemas are identical (no changes).
 *
 * @param source - First schema
 * @param target - Second schema
 * @returns true if schemas are semantically identical
 */
export function schemasAreEqual(source: SchemaAST, target: SchemaAST): boolean {
	return compareSchemas(source, target).length === 0;
}

/**
 * Groups schema changes by table for easier processing.
 *
 * @param changes - Array of schema changes
 * @returns Map of table name to changes for that table
 */
export function groupChangesByTable(
	changes: SchemaChange[],
): Map<string, SchemaChange[]> {
	const grouped = new Map<string, SchemaChange[]>();

	for (const change of changes) {
		const existing = grouped.get(change.table) || [];
		existing.push(change);
		grouped.set(change.table, existing);
	}

	return grouped;
}

/**
 * Filters changes to only include specific types.
 *
 * @param changes - Array of schema changes
 * @param types - Change types to include
 * @returns Filtered array of changes
 */
export function filterChangesByType(
	changes: SchemaChange[],
	types: ChangeType[],
): SchemaChange[] {
	return changes.filter((c) => types.includes(c.type));
}

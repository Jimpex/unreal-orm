import type {
	SchemaAST,
	TableAST,
	FieldAST,
	IndexAST,
	ChangeType as OrmChangeType,
	SchemaChange as OrmSchemaChange,
} from "unreal-orm";
import { compareSchemas as ormCompareSchemas } from "unreal-orm";
import chalk from "chalk";

// Re-export ORM types for convenience
export type { OrmChangeType as ChangeType, OrmSchemaChange as SchemaChange };

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

// Note: ChangeType and SchemaChange are now imported from unreal-orm
// The local types are removed to avoid duplication

type ChangeType = OrmChangeType;
type SchemaChange = OrmSchemaChange & { description: string };

/**
 * Compares two SchemaAST objects and returns structured changes.
 * This enables semantic diffing instead of string comparison.
 *
 * @param source - The "source of truth" schema (what we want to apply)
 * @param target - The "target" schema (what currently exists)
 * @param isPush - If true, source=code, target=database (pushing code to DB)
 *                 If false, source=database, target=code (pulling DB to code)
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

/**
 * Formats schema changes for display.
 */
export function formatChanges(
	changes: SchemaChange[],
	detailed = false,
): string {
	if (changes.length === 0) {
		return chalk.green("✓ Schemas are identical");
	}

	const lines: string[] = [];
	const byTable = new Map<string, SchemaChange[]>();

	// Group by table
	for (const change of changes) {
		const existing = byTable.get(change.table) || [];
		existing.push(change);
		byTable.set(change.table, existing);
	}

	// Format by table
	for (const [table, tableChanges] of byTable) {
		lines.push(chalk.bold(`\n${table}:`));
		for (const change of tableChanges) {
			const icon = getChangeIcon(change.type);
			let colorizedDesc = change.description;

			// Colorize description based on change type
			if (change.type.includes("added")) {
				colorizedDesc = chalk.green(change.description);
			} else if (change.type.includes("removed")) {
				colorizedDesc = chalk.red(change.description);
			} else {
				colorizedDesc = chalk.yellow(change.description);
			}

			lines.push(`  ${icon} ${colorizedDesc}`);

			// Show detailed info if requested
			if (
				detailed &&
				(change.oldValue !== undefined || change.newValue !== undefined)
			) {
				if (change.oldValue !== undefined) {
					lines.push(
						chalk.dim("      Old: ") + chalk.red(formatValue(change.oldValue)),
					);
				}
				if (change.newValue !== undefined) {
					lines.push(
						chalk.dim("      New: ") +
							chalk.green(formatValue(change.newValue)),
					);
				}
			}
		}
	}

	return lines.join("\n");
}

function getChangeIcon(type: ChangeType): string {
	if (type.includes("added")) return chalk.green("+");
	if (type.includes("removed")) return chalk.red("-");
	return chalk.yellow("~");
}

function formatValue(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.join(", ")}]`;
	}
	if (typeof value === "object" && value !== null) {
		// Handle BoundQuery objects from surql templates
		if ("query" in value && typeof value.query === "string") {
			return value.query;
		}
		// Handle other objects
		const str = JSON.stringify(value);
		// If it's a simple object, show it inline
		if (str.length < 50) {
			return str;
		}
		return JSON.stringify(value, null, 2);
	}
	return String(value);
}

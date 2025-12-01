import type { SchemaChange } from "./compare";
import type {
	SchemaAST,
	TableAST,
	FieldAST,
	IndexAST,
} from "../introspection/types";

/**
 * Generates SurrealQL migration statements from schema changes.
 * Only generates the diff, not the entire schema.
 */
export function generateMigrationFromChanges(
	changes: SchemaChange[],
	localSchema: SchemaAST,
	remoteSchema: SchemaAST,
): string {
	const statements: string[] = [];

	// Group changes by table for better organization
	const changesByTable = new Map<string, SchemaChange[]>();
	for (const change of changes) {
		const existing = changesByTable.get(change.table) || [];
		existing.push(change);
		changesByTable.set(change.table, existing);
	}

	// Process each table's changes
	for (const [tableName, tableChanges] of changesByTable) {
		statements.push(`-- Table: ${tableName}`);

		for (const change of tableChanges) {
			const sql = generateChangeStatement(change, localSchema, remoteSchema);
			if (sql) {
				statements.push(sql);
			}
		}

		statements.push(""); // Blank line between tables
	}

	return statements.join("\n");
}

/**
 * Generates SurrealQL for a single schema change.
 * Useful for interactive change-by-change review.
 */
export function generateSqlForChange(
	change: SchemaChange,
	localSchema: SchemaAST,
	remoteSchema: SchemaAST,
): string | null {
	return generateChangeStatement(change, localSchema, remoteSchema);
}

/**
 * Generates a single SurrealQL statement for a schema change.
 *
 * IMPORTANT: For push command, compareSchemas is called with (localSchema, remoteSchema)
 * which inverts the meaning of "added" and "removed":
 * - "table_added" means: exists in first arg (local) but not second (remote) → need to DEFINE
 * - "table_removed" means: exists in second arg (remote) but not first (local) → need to REMOVE
 *
 * The sourceSchema is where we look up definitions (the "from" schema).
 * The targetSchema is what we're syncing to (the "to" schema).
 */
function generateChangeStatement(
	change: SchemaChange,
	sourceSchema: SchemaAST,
	targetSchema: SchemaAST,
): string | null {
	const sourceTable = sourceSchema.tables.find((t) => t.name === change.table);
	const targetTable = targetSchema.tables.find((t) => t.name === change.table);

	switch (change.type) {
		case "table_added": {
			// For push: table exists in local (source) but not remote (target)
			// Generate DEFINE TABLE + all DEFINE FIELD + all DEFINE INDEX statements
			if (!sourceTable) return null;
			return generateFullTableDefine(sourceTable);
		}

		case "table_removed":
			// For push: table exists in remote (target) but not local (source) - REMOVE it
			return `REMOVE TABLE ${change.table};`;

		case "table_type_changed": {
			// Need to redefine the table with source's type (use OVERWRITE)
			if (!sourceTable) return null;
			return generateTableDefine(sourceTable, true);
		}

		case "field_added": {
			// For push: field exists in local (source) but not remote (target) - DEFINE it
			if (!sourceTable || !change.field) return null;
			const fieldToAdd = sourceTable.fields.find(
				(f) => f.name === change.field,
			);
			if (!fieldToAdd) return null;
			return generateFieldDefine(change.table, fieldToAdd);
		}

		case "field_removed":
			// For push: field exists in remote (target) but not local (source) - REMOVE it
			return `REMOVE FIELD ${change.field} ON TABLE ${change.table};`;

		case "field_type_changed":
		case "field_default_changed":
		case "field_assertion_changed": {
			// Field modified - redefine with OVERWRITE
			if (!sourceTable || !change.field) return null;
			const fieldToUpdate = sourceTable.fields.find(
				(f) => f.name === change.field,
			);
			if (!fieldToUpdate) return null;
			return generateFieldDefine(change.table, fieldToUpdate, true);
		}

		case "index_added": {
			// For push: index exists in local (source) but not remote (target) - DEFINE it
			if (!sourceTable || !change.index) return null;
			const indexToAdd = sourceTable.indexes.find(
				(i) => i.name === change.index,
			);
			if (!indexToAdd) return null;
			return generateIndexDefine(change.table, indexToAdd);
		}

		case "index_removed":
			// For push: index exists in remote (target) but not local (source) - REMOVE it
			return `REMOVE INDEX ${change.index} ON TABLE ${change.table};`;

		case "index_modified": {
			// Index modified - redefine with OVERWRITE
			if (!sourceTable || !change.index) return null;
			const indexToUpdate = sourceTable.indexes.find(
				(i) => i.name === change.index,
			);
			if (!indexToUpdate) return null;
			return generateIndexDefine(change.table, indexToUpdate, true);
		}

		default:
			return null;
	}
}

/**
 * Extracts the table name from a record type like "record<user>" -> "user"
 */
function extractTableFromRecordType(type: string): string | null {
	const match = type.match(/^record<(\w+)>$/);
	return match?.[1] ?? null;
}

/**
 * Generates a complete table definition including all fields and indexes.
 * Used when creating a new table.
 */
function generateFullTableDefine(table: TableAST): string {
	const statements: string[] = [];

	// Generate DEFINE TABLE
	statements.push(generateTableDefine(table));

	// Generate DEFINE FIELD for each field
	for (const field of table.fields) {
		// Skip array element fields (e.g., tags[*]) - they're auto-created by array<T> type
		if (field.name.includes("[*]")) {
			continue;
		}
		// For relation tables, in/out fields need OVERWRITE since table definition creates them
		const needsOverwrite =
			table.type === "RELATION" &&
			(field.name === "in" || field.name === "out");
		statements.push(generateFieldDefine(table.name, field, needsOverwrite));
	}

	// Generate DEFINE INDEX for each index
	for (const index of table.indexes) {
		statements.push(generateIndexDefine(table.name, index));
	}

	return statements.join("\n");
}

/**
 * Generates DEFINE TABLE statement.
 * @param overwrite - If true, uses OVERWRITE keyword for modifying existing tables
 */
function generateTableDefine(table: TableAST, overwrite = false): string {
	const keyword = overwrite ? "DEFINE TABLE OVERWRITE" : "DEFINE TABLE";
	const parts: string[] = [`${keyword} ${table.name}`];

	if (table.type === "RELATION") {
		parts.push("TYPE RELATION");
	} else if (table.type === "VIEW") {
		parts.push("TYPE ANY");
		if (table.viewQuery) parts.push(`AS ${table.viewQuery}`);
	}

	if (table.schemafull) {
		parts.push("SCHEMAFULL");
	}

	// Format permissions if they exist
	const permParts: string[] = [];
	if (table.permissions.select)
		permParts.push(`FOR select ${table.permissions.select}`);
	if (table.permissions.create)
		permParts.push(`FOR create ${table.permissions.create}`);
	if (table.permissions.update)
		permParts.push(`FOR update ${table.permissions.update}`);
	if (table.permissions.delete)
		permParts.push(`FOR delete ${table.permissions.delete}`);

	if (permParts.length > 0) {
		parts.push(`PERMISSIONS ${permParts.join(", ")}`);
	}

	return `${parts.join(" ")};`;
}

/**
 * Generates DEFINE FIELD statement.
 * @param overwrite - If true, uses OVERWRITE keyword for modifying existing fields
 */
function generateFieldDefine(
	tableName: string,
	field: FieldAST,
	overwrite = false,
): string {
	const keyword = overwrite ? "DEFINE FIELD OVERWRITE" : "DEFINE FIELD";
	const parts: string[] = [`${keyword} ${field.name} ON TABLE ${tableName}`];

	if (field.flex) {
		parts.push("FLEXIBLE");
	}

	if (field.type) {
		parts.push(`TYPE ${field.type}`);
	}

	if (field.value) {
		parts.push(`VALUE ${field.value}`);
	}

	if (field.assert) {
		parts.push(`ASSERT ${field.assert}`);
	}

	if (field.default) {
		parts.push(`DEFAULT ${field.default}`);
	}

	// Format permissions if they exist
	const permParts: string[] = [];
	if (field.permissions.select)
		permParts.push(`FOR select ${field.permissions.select}`);
	if (field.permissions.create)
		permParts.push(`FOR create ${field.permissions.create}`);
	if (field.permissions.update)
		permParts.push(`FOR update ${field.permissions.update}`);
	if (field.permissions.delete)
		permParts.push(`FOR delete ${field.permissions.delete}`);

	if (permParts.length > 0) {
		parts.push(`PERMISSIONS ${permParts.join(", ")}`);
	}

	return `${parts.join(" ")};`;
}

/**
 * Generates DEFINE INDEX statement.
 * @param overwrite - If true, uses OVERWRITE keyword for modifying existing indexes
 */
function generateIndexDefine(
	tableName: string,
	index: IndexAST,
	overwrite = false,
): string {
	const keyword = overwrite ? "DEFINE INDEX OVERWRITE" : "DEFINE INDEX";
	const parts: string[] = [`${keyword} ${index.name} ON TABLE ${tableName}`];

	if (index.columns && index.columns.length > 0) {
		parts.push(`FIELDS ${index.columns.join(", ")}`);
	}

	if (index.unique) {
		parts.push("UNIQUE");
	}

	if (index.search) {
		parts.push("SEARCH ANALYZER");
	}

	return `${parts.join(" ")};`;
}

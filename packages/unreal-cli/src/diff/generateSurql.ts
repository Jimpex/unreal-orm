import type {
	SchemaAST,
	TableAST,
	FieldAST,
	IndexAST,
} from "../introspection/types";

/**
 * Generates SurrealQL DEFINE statements from SchemaAST.
 * This is the reverse of the parser and mirrors the logic in unreal-orm's DDL generators.
 *
 * Reference: packages/unreal-orm/src/schema/ddl/
 */

export type SchemaApplicationMethod = "IF NOT EXISTS" | "OVERWRITE" | "error";

/**
 * Generates a complete SurrealQL schema from SchemaAST.
 */
export function generateSurqlFromAST(
	schema: SchemaAST,
	method: SchemaApplicationMethod = "error",
): string {
	const statements: string[] = [];

	for (const table of schema.tables) {
		// Generate table DDL
		statements.push(generateTableDdl(table, method));

		// Generate field DDLs
		for (const field of table.fields) {
			statements.push(generateFieldDdl(table.name, field, method));
		}

		// Generate index DDLs
		for (const index of table.indexes) {
			statements.push(generateIndexDdl(table.name, index, method));
		}

		statements.push(""); // Empty line between tables
	}

	return statements.join("\n");
}

/**
 * Generates a DEFINE TABLE statement.
 * Based on: packages/unreal-orm/src/schema/ddl/table.ts
 */
function generateTableDdl(
	table: TableAST,
	method: SchemaApplicationMethod,
): string {
	let statement = "DEFINE TABLE";

	if (method !== "error") {
		statement += ` ${method}`;
	}

	statement += ` ${table.name}`;

	// Add table type
	if (table.type === "RELATION") {
		statement += " TYPE RELATION";
	} else if (table.type === "NORMAL" || table.type === "VIEW") {
		statement += " TYPE NORMAL";
	}

	// Add schemafull/schemaless
	if (table.schemafull) {
		statement += " SCHEMAFULL";
	} else {
		statement += " SCHEMALESS";
	}

	// Add view definition
	if (table.type === "VIEW" && table.viewQuery) {
		statement += ` AS ${table.viewQuery}`;
	}

	// Add permissions
	if (table.permissions) {
		const permClauses: string[] = [];
		if (table.permissions.select) {
			permClauses.push(`FOR select ${table.permissions.select}`);
		}
		if (table.permissions.create) {
			permClauses.push(`FOR create ${table.permissions.create}`);
		}
		if (table.permissions.update) {
			permClauses.push(`FOR update ${table.permissions.update}`);
		}
		if (table.permissions.delete) {
			permClauses.push(`FOR delete ${table.permissions.delete}`);
		}
		if (permClauses.length > 0) {
			statement += ` PERMISSIONS ${permClauses.join(", ")}`;
		}
	}

	return `${statement};`;
}

/**
 * Generates a DEFINE FIELD statement.
 * Based on: packages/unreal-orm/src/schema/ddl/field.ts
 */
function generateFieldDdl(
	tableName: string,
	field: FieldAST,
	method: SchemaApplicationMethod,
): string {
	let statement = "DEFINE FIELD";

	if (method !== "error") {
		statement += ` ${method}`;
	}

	statement += ` ${field.name} ON TABLE ${tableName}`;

	// Add FLEXIBLE if needed
	if (field.flex) {
		statement += " FLEXIBLE";
	}

	// Add TYPE
	statement += ` TYPE ${field.type}`;

	// Add ASSERT
	if (field.assert) {
		statement += ` ASSERT ${field.assert}`;
	}

	// Add VALUE (computed field)
	if (field.value) {
		statement += ` VALUE ${field.value}`;
	}

	// Add DEFAULT
	if (field.default) {
		statement += ` DEFAULT ${field.default}`;
	}

	// Add permissions
	if (field.permissions) {
		const permClauses: string[] = [];
		if (field.permissions.select) {
			permClauses.push(`FOR select ${field.permissions.select}`);
		}
		if (field.permissions.create) {
			permClauses.push(`FOR create ${field.permissions.create}`);
		}
		if (field.permissions.update) {
			permClauses.push(`FOR update ${field.permissions.update}`);
		}
		if (field.permissions.delete) {
			permClauses.push(`FOR delete ${field.permissions.delete}`);
		}
		if (permClauses.length > 0) {
			statement += ` PERMISSIONS ${permClauses.join(" ")}`;
		}
	}

	return `${statement};`;
}

/**
 * Generates a DEFINE INDEX statement.
 * Based on: packages/unreal-orm/src/schema/ddl/index.ts
 */
function generateIndexDdl(
	tableName: string,
	index: IndexAST,
	method: SchemaApplicationMethod,
): string {
	let statement = "DEFINE INDEX";

	if (method !== "error") {
		statement += ` ${method}`;
	}

	statement += ` ${index.name} ON TABLE ${tableName} FIELDS ${index.columns.join(", ")}`;

	if (index.unique) {
		statement += " UNIQUE";
	}

	if (index.search) {
		statement += " SEARCH";
	}

	return `${statement};`;
}

/**
 * Generates only the DEFINE statements needed for specific changes.
 * This is used for migrations in the push command.
 */
export function generateMigrationSurql(
	changes: Array<{
		type: string;
		table: string;
		field?: string;
		index?: string;
		newValue?: unknown;
	}>,
): string {
	const statements: string[] = [];

	for (const change of changes) {
		switch (change.type) {
			case "table_added":
				// Would need full table AST to generate this
				statements.push(`-- TODO: DEFINE TABLE ${change.table}`);
				break;

			case "field_added":
				if (change.field && change.newValue) {
					statements.push(
						`DEFINE FIELD ${change.field} ON TABLE ${change.table} TYPE ${change.newValue};`,
					);
				}
				break;

			case "field_type_changed":
				if (change.field && change.newValue) {
					statements.push(
						`DEFINE FIELD OVERWRITE ${change.field} ON TABLE ${change.table} TYPE ${change.newValue};`,
					);
				}
				break;

			case "index_added":
				if (change.index && Array.isArray(change.newValue)) {
					statements.push(
						`DEFINE INDEX ${change.index} ON TABLE ${change.table} FIELDS ${(change.newValue as string[]).join(", ")};`,
					);
				}
				break;

			case "index_removed":
				if (change.index) {
					statements.push(
						`REMOVE INDEX ${change.index} ON TABLE ${change.table};`,
					);
				}
				break;

			case "field_removed":
				if (change.field) {
					statements.push(
						`REMOVE FIELD ${change.field} ON TABLE ${change.table};`,
					);
				}
				break;

			case "table_removed":
				statements.push(`REMOVE TABLE ${change.table};`);
				break;

			default:
				statements.push(`-- TODO: Handle ${change.type}`);
		}
	}

	return statements.join("\n");
}

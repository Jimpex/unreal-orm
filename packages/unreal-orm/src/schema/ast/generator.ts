/**
 * SurrealQL Generator - Converts SchemaAST to SurrealQL DEFINE statements.
 *
 * This module generates SurrealQL from the intermediate AST representation,
 * enabling schema application and migration generation.
 *
 * @module
 */

import type { SchemaAST, TableAST, FieldAST, IndexAST } from "./types";
import type { SchemaChange } from "./compare";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Specifies the method for applying a schema definition when an entity already exists.
 * - `IF NOT EXISTS`: The `DEFINE` statement will only be executed if the entity does not already exist.
 * - `OVERWRITE`: The existing entity will be overwritten with the new definition. **Warning: This is a destructive operation.**
 * - `error`: (Default) An error will be thrown if the entity already exists.
 */
export type SchemaApplicationMethod = "IF NOT EXISTS" | "OVERWRITE" | "error";

// ============================================================================
// TABLE GENERATION
// ============================================================================

/**
 * Generates a DEFINE TABLE statement from a TableAST.
 *
 * @param table - The table AST
 * @param method - Schema application method
 * @returns SurrealQL DEFINE TABLE statement
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

	// Add schemafull/schemaless - only if explicitly set
	// SurrealDB defaults to SCHEMALESS if not specified
	if (table.schemafull === true) {
		statement += " SCHEMAFULL";
	} else if (table.schemafull === false) {
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

// ============================================================================
// FIELD GENERATION
// ============================================================================

/**
 * Generates a DEFINE FIELD statement from a FieldAST.
 *
 * @param tableName - The table this field belongs to
 * @param field - The field AST
 * @param method - Schema application method
 * @returns SurrealQL DEFINE FIELD statement
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

	// Add READONLY
	if (field.readonly) {
		statement += " READONLY";
	}

	// Add REFERENCE
	if (field.reference) {
		statement += " REFERENCE";
		if (field.onDelete) {
			statement += ` ON DELETE ${field.onDelete}`;
		}
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

	// Add COMMENT
	if (field.comment) {
		statement += ` COMMENT '${field.comment.replace(/'/g, "''")}'`;
	}

	return `${statement};`;
}

// ============================================================================
// INDEX GENERATION
// ============================================================================

/**
 * Generates a DEFINE INDEX statement from an IndexAST.
 *
 * @param tableName - The table this index belongs to
 * @param index - The index AST
 * @param method - Schema application method
 * @returns SurrealQL DEFINE INDEX statement
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
		if (index.analyzer) {
			statement += ` ANALYZER ${index.analyzer}`;
		}
	}

	// Add COMMENT
	if (index.comment) {
		statement += ` COMMENT '${index.comment.replace(/'/g, "''")}'`;
	}

	return `${statement};`;
}

// ============================================================================
// FULL SCHEMA GENERATION
// ============================================================================

/**
 * Generates a complete SurrealQL schema from SchemaAST.
 *
 * @param schema - The schema AST
 * @param method - Schema application method
 * @returns Complete SurrealQL schema as a string
 *
 * @example
 * ```ts
 * const schema = extractSchemaFromDefinables([User, Post]);
 * const sql = generateSurqlFromAST(schema, "OVERWRITE");
 * await db.query(sql);
 * ```
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

// ============================================================================
// MIGRATION GENERATION
// ============================================================================

/**
 * Generates only the DEFINE/REMOVE statements needed for specific changes.
 * This is used for generating migrations from schema diffs.
 *
 * @param changes - Array of schema changes from compareSchemas
 * @param schema - Optional source schema for full table definitions
 * @returns SurrealQL migration statements
 *
 * @example
 * ```ts
 * const changes = compareSchemas(codeSchema, dbSchema, true);
 * const migration = generateMigrationSurql(changes, codeSchema);
 * await db.query(migration);
 * ```
 */
export function generateMigrationSurql(
	changes: SchemaChange[],
	schema?: SchemaAST,
): string {
	const statements: string[] = [];
	const schemaMap = schema
		? new Map(schema.tables.map((t) => [t.name, t]))
		: null;

	for (const change of changes) {
		switch (change.type) {
			case "table_added": {
				// Generate full table definition if schema provided
				if (schemaMap) {
					const table = schemaMap.get(change.table);
					if (table) {
						statements.push(generateTableDdl(table, "error"));
						for (const field of table.fields) {
							statements.push(generateFieldDdl(table.name, field, "error"));
						}
						for (const index of table.indexes) {
							statements.push(generateIndexDdl(table.name, index, "error"));
						}
					}
				} else {
					statements.push(`-- TODO: DEFINE TABLE ${change.table}`);
				}
				break;
			}

			case "table_removed":
				statements.push(`REMOVE TABLE ${change.table};`);
				break;

			case "field_added":
				if (change.field && change.newValue) {
					statements.push(
						`DEFINE FIELD ${change.field} ON TABLE ${change.table} TYPE ${change.newValue};`,
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

			case "field_type_changed":
			case "field_default_changed":
			case "field_value_changed":
			case "field_assertion_changed": {
				// For field modifications, regenerate the full field definition
				if (schemaMap && change.field) {
					const table = schemaMap.get(change.table);
					const field = table?.fields.find((f) => f.name === change.field);
					if (field) {
						statements.push(generateFieldDdl(change.table, field, "OVERWRITE"));
					}
				} else if (change.field && change.newValue) {
					statements.push(
						`DEFINE FIELD OVERWRITE ${change.field} ON TABLE ${change.table} TYPE ${change.newValue};`,
					);
				}
				break;
			}

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

			case "index_modified": {
				// For index modifications, remove and recreate
				if (schemaMap && change.index) {
					const table = schemaMap.get(change.table);
					const index = table?.indexes.find((i) => i.name === change.index);
					if (index) {
						statements.push(
							`REMOVE INDEX ${change.index} ON TABLE ${change.table};`,
						);
						statements.push(generateIndexDdl(change.table, index, "error"));
					}
				}
				break;
			}

			case "table_type_changed":
				statements.push(
					`-- WARNING: Table type changed for '${change.table}'. Manual migration required.`,
				);
				break;

			default:
				statements.push(`-- TODO: Handle ${change.type}`);
		}
	}

	return statements.join("\n");
}

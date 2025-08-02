// Schema generator functions for Unreal-ORM
import type { Surreal } from "surrealdb";
import type { Definable } from "../define/types";
import type { AnyModelClass } from "../define/table/types/model";
import type { IndexDefinition } from "../define/index/types";
import { generateTableDdl } from "./ddl/table";
import { generateFieldsDdl } from "./ddl/field";
import { generateIndexDdl } from "./ddl/index";

/**
 * Specifies the method for applying a schema definition when a table already exists.
 * - `IF NOT EXISTS`: The `DEFINE` statement will only be executed if the table does not already exist.
 * - `OVERWRITE`: The existing table will be overwritten with the new definition. **Warning: This is a destructive operation.**
 * - `error`: (Default) An error will be thrown if the table already exists.
 */
export type SchemaApplicationMethod = "IF NOT EXISTS" | "OVERWRITE" | "error";

/**
 * Generates the full SurrealQL schema for a single table model.
 * This includes the `DEFINE TABLE` statement and all associated `DEFINE FIELD` statements.
 *
 * @internal This is a low-level utility. Prefer `generateFullSchemaQl` for generating the complete schema.
 * @param modelClass The model class to generate the schema for.
 * @param method The method to use for schema application if the table already exists.
 * @returns A string containing the full SurrealQL schema for the table.
 */
export function generateTableSchemaQl(
	modelClass: AnyModelClass,
	method: SchemaApplicationMethod = "error",
): string {
	const tableDdl = generateTableDdl(modelClass, method);
	const fieldsDdl = generateFieldsDdl(modelClass, method);
	const allStatements = [tableDdl, ...fieldsDdl];

	return allStatements.join("\n");
}

/**
 * Generates the full SurrealQL schema for all provided definable entities (tables and indexes).
 *
 * @param definables An array of `Definable` entities (model classes and index definitions).
 * @param method The method to use for schema application if a table already exists.
 * @returns A string containing the complete SurrealQL schema.
 */
export function generateFullSchemaQl(
	definables: Definable[],
	method: SchemaApplicationMethod = "error",
): string {
	const modelClasses = definables.filter(
		(d): d is AnyModelClass => !("_type" in d),
	);
	const indexes = definables.filter(
		(d): d is IndexDefinition => "_type" in d && d._type === "index",
	);

	const tableSchemas = modelClasses
		.map((mc) => generateTableSchemaQl(mc, method))
		.join("\n\n");

	const indexSchemas = indexes.map((idx) => generateIndexDdl(idx, method)).join("\n");

	const schema = [tableSchemas, indexSchemas].filter(Boolean).join("\n\n");
	// TODO: Debug logging
	// console.debug("[ORM DEBUG]:\n", schema);

	return schema;
}

/**
 * Generates and applies the full SurrealQL schema to a SurrealDB instance.
 *
 * @param db The SurrealDB instance to apply the schema to.
 * @param definables An array of `Definable` entities (model classes and index definitions).
 * @param method The method to use for schema application if a table already exists.
 */
export async function applySchema(
	db: Surreal,
	definables: Definable[],
	method: SchemaApplicationMethod = "error",
): Promise<void> {
	const schemaQl = generateFullSchemaQl(definables, method);
	if (schemaQl.trim() !== "") {
		await db.query(schemaQl);
	}
}

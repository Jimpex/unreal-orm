// Schema generator functions for Unreal-ORM
import type { Surreal } from "surrealdb";
import type { Definable } from "../define/types";
import type { AnyModelClass } from "../define/table/types/model";
import type { IndexDefinition } from "../define/index/types";
import { generateTableDdl } from "./ddl/table";
import { generateFieldsDdl } from "./ddl/field";
import { generateIndexDdl } from "./ddl/index";

export type SchemaApplicationMethod = "IF NOT EXISTS" | "OVERWRITE" | "error";

export function generateTableSchemaQl(
	modelClass: AnyModelClass,
	method: SchemaApplicationMethod = "error",
): string {
	const tableDdl = generateTableDdl(modelClass, method);
	const fieldsDdl = generateFieldsDdl(modelClass);
	const allStatements = [tableDdl, ...fieldsDdl];

	return allStatements.join("\n");
}

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

	const indexSchemas = indexes.map(generateIndexDdl).join("\n");

	const schema = [tableSchemas, indexSchemas].filter(Boolean).join("\n\n");
	// TODO: Debug logging
	// console.debug("[ORM DEBUG]:\n", schema);

	return schema;
}

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

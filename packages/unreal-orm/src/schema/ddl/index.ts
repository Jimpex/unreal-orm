import type { IndexDefinition } from "../../define/index/types";

/**
 * Generates a SurrealQL `DEFINE INDEX` statement for a given index definition.
 *
 * @internal This is a low-level utility for building parts of the full schema.
 * It is used by the main `generateFullSchemaQl` function and is not intended for direct use.
 *
 * @param indexDef The index definition object.
 * @returns A string containing the complete `DEFINE INDEX ...;` statement.
 */
export function generateIndexDdl(indexDef: IndexDefinition): string {
	const tableName = indexDef.table._tableName;
	let indexStatement = `DEFINE INDEX ${indexDef.name} ON TABLE ${tableName} FIELDS ${indexDef.fields.join(", ")}`;

	if (indexDef.unique) {
		indexStatement += " UNIQUE";
	}
	if (indexDef.analyzer) {
		indexStatement += ` ANALYZER ${indexDef.analyzer}`;
	}
	if (indexDef.comment) {
		indexStatement += ` COMMENT '${indexDef.comment.replace(/'/g, "''")}'`;
	}

	return `${indexStatement};`;
}

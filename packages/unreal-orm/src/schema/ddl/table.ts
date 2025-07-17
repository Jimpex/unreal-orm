import type { AnyModelClass } from "../../define/table/types/model";
import type { SchemaApplicationMethod } from "../generator";

/**
 * Generates a SurrealQL `DEFINE TABLE` statement for a given model class.
 *
 * This function constructs the `DEFINE TABLE` DDL, incorporating options such as
 * `SCHEMAFULL`/`SCHEMALESS` and table-level `PERMISSIONS`.
 *
 * @internal This is a low-level utility for building parts of the full schema.
 * It is used by the main `generateTableSchemaQl` function and is not intended for direct use.
 *
 * @param modelClass The model class to generate the table DDL for.
 * @param method The method to use for schema application if the table already exists.
 * @returns A string containing the complete `DEFINE TABLE ...;` statement.
 */
export function generateTableDdl(
	modelClass: AnyModelClass,
	method: SchemaApplicationMethod = "error",
): string {
	const tableName = modelClass._tableName;
	const options = modelClass._options;

	let defineTableStatement = "DEFINE TABLE";
	if (method !== "error") {
		defineTableStatement += ` ${method}`;
	}
	defineTableStatement += ` ${tableName}`;

	const schemafullOpt = options.schemafull;

	if (schemafullOpt === true) {
		defineTableStatement += " SCHEMAFULL";
	} else if (schemafullOpt === false) {
		defineTableStatement += " SCHEMALESS";
	}

	if (options.permissions) {
		const { permissions } = options;
		const permissionsClauses: string[] = [];
		if (permissions.select)
			permissionsClauses.push(`FOR select ${permissions.select}`);
		if (permissions.create)
			permissionsClauses.push(`FOR create ${permissions.create}`);
		if (permissions.update)
			permissionsClauses.push(`FOR update ${permissions.update}`);
		if (permissions.delete)
			permissionsClauses.push(`FOR delete ${permissions.delete}`);
		if (permissionsClauses.length > 0) {
			defineTableStatement += ` PERMISSIONS ${permissionsClauses.join(", ")}`;
		}
	}

	return `${defineTableStatement};`;
}

import type { AnyModelClass } from "../../define/table/types/model";
import type { FieldDefinition } from "../../define/field/types";
import type { SchemaApplicationMethod } from "../generator";
import type { BoundQuery, Expr } from "surrealdb";
import type { FieldPermissionsOptions } from "../../define/field/types";
import { enumerateSubfields } from "../../define/field/utils";
import { surql } from "surrealdb";

/**
 * Converts a BoundQuery or Expr to a string for DDL generation.
 *
 * @param value The BoundQuery or Expr to convert.
 * @returns The string representation of the query.
 * @internal This is a low-level utility for DDL generation.
 */
function queryToString(value: BoundQuery | Expr): string {
	// Handle BoundQuery
	if ("query" in value) {
		return value.query;
	}
	// Handle Expr - convert to BoundQuery using surql template
	const boundQuery = surql`${value}`;
	return boundQuery.query;
}

/**
 * Generates an array of SurrealQL `DEFINE FIELD` statements for a given model class.
 *
 * This function iterates over all fields defined in the model, including nested fields
 * within objects and arrays, and constructs the appropriate DDL statement for each.
 * It handles all supported field options, such as type constraints, default values,
 * assertions, permissions, and comments.
 *
 * @internal This is a low-level utility for building parts of the full schema.
 * It is used by the main `generateTableSchemaQl` function and is not intended for direct use.
 *
 * @param modelClass The model class to generate field DDL for.
 * @param method The method to use for schema application if the field already exists.
 * @returns An array of strings, where each string is a complete `DEFINE FIELD ...;` statement.
 */
export function generateFieldsDdl(
	modelClass: AnyModelClass,
	method: SchemaApplicationMethod = "error",
): string[] {
	const tableName = modelClass._tableName;
	const fields = modelClass._fields;
	const allStatements: string[] = [];

	for (const [fieldName, fieldDef] of Object.entries(fields) as [
		string,
		FieldDefinition<unknown>,
	][]) {
		const subfields = enumerateSubfields(fieldDef, fieldName);
		for (const { path, fieldDef: subDef } of subfields) {
			if (/\[\*\]$/.test(path)) continue;
			let fieldStatement = "DEFINE FIELD";
			if (method !== "error") {
				fieldStatement += ` ${method}`;
			}
			fieldStatement += ` ${path} ON TABLE ${tableName}`;

			if (subDef.flexible === true) {
				fieldStatement += " FLEXIBLE";
			}
			fieldStatement += ` TYPE ${subDef.type}`;

			if (subDef.assert) {
				fieldStatement += ` ASSERT ${queryToString(subDef.assert)}`;
			}
			if (subDef.value) {
				fieldStatement += ` VALUE ${queryToString(subDef.value)}`;
			}

			if (subDef.default) {
				fieldStatement += ` DEFAULT ${queryToString(subDef.default)}`;
			}

			if (subDef.readonly) {
				fieldStatement += " READONLY";
			}

			if (subDef.permissions) {
				const permParts: string[] = [];
				if (
					"select" in subDef.permissions ||
					"create" in subDef.permissions ||
					"update" in subDef.permissions ||
					"delete" in subDef.permissions
				) {
					// Handle FieldPermissionsOptions object
					const perms = subDef.permissions as FieldPermissionsOptions;
					if (perms.select)
						permParts.push(`FOR select ${queryToString(perms.select)}`);
					if (perms.create)
						permParts.push(`FOR create ${queryToString(perms.create)}`);
					if (perms.update)
						permParts.push(`FOR update ${queryToString(perms.update)}`);
					if (perms.delete)
						permParts.push(`FOR delete ${queryToString(perms.delete)}`);
				} else {
					// Handle BoundQuery | Expr directly
					const perms = subDef.permissions as BoundQuery | Expr;
					permParts.push(queryToString(perms));
				}
				if (permParts.length > 0) {
					fieldStatement += ` PERMISSIONS ${permParts.join(" ")}`;
				}
			}

			if (subDef.comment) {
				fieldStatement += ` COMMENT '${subDef.comment.replace(/'/g, "''")}'`;
			}

			allStatements.push(`${fieldStatement};`);
		}
	}

	return allStatements;
}

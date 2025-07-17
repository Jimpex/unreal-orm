import type { AnyModelClass } from "../../define/table/types/model";
import type { FieldDefinition } from "../../define/field/types";
import { enumerateSubfields } from "../../define/field/utils";

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
 * @returns An array of strings, where each string is a complete `DEFINE FIELD ...;` statement.
 */
export function generateFieldsDdl(modelClass: AnyModelClass): string[] {
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
			let fieldStatement = `DEFINE FIELD ${path} ON TABLE ${tableName}`;

			if (subDef.flexible === true) {
				fieldStatement += " FLEXIBLE";
			}
			fieldStatement += ` TYPE ${subDef.type}`;

			if (subDef.assert) {
				fieldStatement += ` ASSERT ${subDef.assert}`;
			}
			if (subDef.value) {
				fieldStatement += ` VALUE ${subDef.value}`;
			}

			if (subDef.default) {
				fieldStatement += ` DEFAULT ${subDef.default}`;
			}

			if (subDef.readonly) {
				fieldStatement += " READONLY";
			}

			if (subDef.permissions) {
				const permParts: string[] = [];
				if (typeof subDef.permissions === "string") {
					permParts.push(subDef.permissions);
				} else {
					if (subDef.permissions.select)
						permParts.push(`FOR select ${subDef.permissions.select}`);
					if (subDef.permissions.create)
						permParts.push(`FOR create ${subDef.permissions.create}`);
					if (subDef.permissions.update)
						permParts.push(`FOR update ${subDef.permissions.update}`);
					if (subDef.permissions.delete)
						permParts.push(`FOR delete ${subDef.permissions.delete}`);
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

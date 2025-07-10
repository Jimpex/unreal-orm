import type { Surreal } from "surrealdb";
import type { AnyModelClass, FieldDefinition, FieldOptions } from "./types"; // FieldOptions replaces BaseFieldOptions
import { enumerateSubfields } from "./fieldUtils";

export type SchemaApplicationMethod = "IF NOT EXISTS" | "OVERWRITE" | "error";

/**
 * Generates SurrealQL DDL statements for a single table model, including all fields, indexes, and permissions.
 *
 * @param modelClass The model class (output of Table.normal)
 * @param method How to apply the schema (e.g., 'IF NOT EXISTS', 'DROP', etc.)
 * @returns A string containing SurrealQL DDL statements for the table
 *
 * @example
 *   import { Table, Field, generateTableSchemaQl } from 'unreal-orm';
 *   const User = Table.normal({
 *     name: 'user',
 *     fields: { name: Field.string() }
 *   });
 *   const ddl = generateTableSchemaQl(User);
 *   // Pass `ddl` to SurrealDB for schema migration
 */
export function generateTableSchemaQl(
	modelClass: AnyModelClass,
	method: SchemaApplicationMethod = "error",
): string {
	const tableName = modelClass._tableName;
	const fields = modelClass._fields;
	const options = modelClass._options;

	const allStatements: string[] = [];

	// 1. DEFINE TABLE statement
	let defineTableStatement = "DEFINE TABLE";
	if (method !== "error") {
		defineTableStatement += ` ${method}`;
	}
	defineTableStatement += ` ${tableName}`;

	const schemafullOpt = options.schemafull;
	// const typeOpt = options.type; // Assuming 'type' might be an option for table type like 'NORMAL', 'ANY'
	const hasFields = Object.keys(fields).length > 0;
	// let typeKeyword: string | undefined = undefined;

	// if (typeof typeOpt === 'string') {
	//   typeKeyword = typeOpt;
	// } else if (typeof typeOpt === 'object' && typeOpt !== null && 'kind' in typeOpt && typeof (typeOpt as { kind: unknown }).kind === 'string') {
	//   typeKeyword = (typeOpt as { kind: string }).kind;
	// }

	if (schemafullOpt === true) {
		defineTableStatement += " SCHEMAFULL";
	} else if (schemafullOpt === false) {
		defineTableStatement += " SCHEMALESS";
	}
	// else if (typeKeyword === 'normal') {
	//   defineTableStatement += ' TYPE NORMAL';
	// } else if (typeKeyword === 'any') {
	//   defineTableStatement += ' TYPE ANY';
	// } else if (typeKeyword === 'schemaless') {
	//   defineTableStatement += ' TYPE SCHEMALESS';
	// }
	// else if (
	// 	schemafullOpt === undefined /*&& typeKeyword === undefined*/ &&
	// 	hasFields
	// ) {
	// 	// Default to SCHEMAFULL if no explicit 'schemafull: true' and no recognized 'type' is set, and fields exist.
	// 	defineTableStatement += " SCHEMAFULL";
	// }

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

	// if (options.comment) { // Assuming 'comment' might be an option
	//   defineTableStatement += ` COMMENT '${options.comment}'`;
	// }
	allStatements.push(`${defineTableStatement};`);

	// 2. DEFINE FIELD statements using enumerateSubfields utility
	for (const [fieldName, fieldDef] of Object.entries(fields)) {
		const subfields = enumerateSubfields(fieldDef, fieldName);
		// Filter out array root paths like 'field[*]' unless the element type is primitive (no objectSchema)
		for (const { path, fieldDef: subDef } of subfields) {
			// Never emit a field for 'field[*]' (array element root); only emit the root array and subfields
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

	// 3. DEFINE INDEX statements
	if (options.indexes && Array.isArray(options.indexes)) {
		for (const indexDef of options.indexes) {
			let indexStatement = `DEFINE INDEX ${indexDef.name} ON TABLE ${tableName} FIELDS ${indexDef.fields.join(", ")}`;
			if (indexDef.unique) {
				indexStatement += " UNIQUE"; // No interpolation
			}
			if (indexDef.analyzer) {
				indexStatement += ` ANALYZER ${indexDef.analyzer}`;
			}
			if (indexDef.comment) {
				indexStatement += ` COMMENT '${indexDef.comment.replace(/'/g, "''")}'`;
			}
			allStatements.push(`${indexStatement};`);
		}
	}

	return allStatements.join("\n");
}

/**
 * Generates SurrealQL DDL statements for multiple model classes (tables).
 * Useful for initializing or migrating the full database schema.
 *
 * @param modelClasses Array of model classes (output of Table.normal)
 * @param method How to apply the schema (e.g., 'IF NOT EXISTS', 'DROP', etc.)
 * @returns A string containing SurrealQL DDL statements for all tables
 *
 * @example
 *   import { Table, Field, generateFullSchemaQl } from 'unreal-orm';
 *   const User = Table.normal({ ... });
 *   const Post = Table.normal({ ... });
 *   const ddl = generateFullSchemaQl([User, Post]);
 *   // Pass `ddl` to SurrealDB for schema migration
 */
export function generateFullSchemaQl(
	modelClasses: AnyModelClass[],
	method: SchemaApplicationMethod = "error",
): string {
	const schema = modelClasses
		.map((mc) => generateTableSchemaQl(mc, method))
		.join("\n\n");
	console.debug("[ORM DEBUG]:\n", schema);

	return schema;
}

/**
 * Applies the generated SurrealQL schema to the database by executing DDL statements.
 *
 * @param db The SurrealDB client instance
 * @param modelClasses Array of model classes (output of Table.normal)
 * @param method How to apply the schema (e.g., 'IF NOT EXISTS')
 * @returns Promise<void> (resolves when schema has been applied)
 *
 * @example
 *   import { applySchema, Table, Field } from 'unreal-orm';
 *   const User = Table.normal({ ... });
 *   const Post = Table.normal({ ... });
 *   await applySchema(db, [User, Post]);
 */
export async function applySchema(
	db: Surreal,
	modelClasses: AnyModelClass[],
	method: SchemaApplicationMethod = "error",
): Promise<void> {
	const schemaQl = generateFullSchemaQl(modelClasses, method);
	if (schemaQl.trim() !== "") {
		await db.query(schemaQl);
	}
}

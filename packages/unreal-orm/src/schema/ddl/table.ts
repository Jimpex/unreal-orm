import type { AnyModelClass } from "../../define/table/types/model";
import type { SchemaApplicationMethod } from "../generator";

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

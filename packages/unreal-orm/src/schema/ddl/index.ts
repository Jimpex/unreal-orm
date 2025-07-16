import type { IndexDefinition } from "../../define/index/types";

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

import type { AnyModelClass } from "../table/types/model";

export interface IndexDefinition {
	_type: "index";
	name: string;
	table: AnyModelClass;
	fields: string[];
	unique?: boolean;
	analyzer?: string;
	comment?: string;
}

export type IndexDefineOptions = Omit<IndexDefinition, "table" | "_type">;

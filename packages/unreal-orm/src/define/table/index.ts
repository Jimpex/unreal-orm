import type { TableDefineOptions } from "./types/model";

import type { FieldDefinition } from "../../schema/field-definitions/definitions";
import type {
	NormalTableOptions,
	RelationTableFields,
	RelationTableOptions,
} from "../../schema/options";
import { createBaseModel } from "./base";
import { getCreateMethod } from "./crud/create";
import { getDeleteMethod, getStaticDeleteMethod } from "./crud/delete";
import { getSelectMethod } from "./crud/select";
import { getUpdateMethod, getStaticUpdateMethod } from "./crud/update";

function defineTable<TFields extends Record<string, FieldDefinition<unknown>>>(
	options: TableDefineOptions<TFields>,
) {
	const staticMethods = {
		create: getCreateMethod<TFields>(),
		select: getSelectMethod<TFields>(),
		update: getStaticUpdateMethod<TFields>(),
		delete: getStaticDeleteMethod<TFields>(),
	};

	const instanceMethods = {
		update: getUpdateMethod<TFields>(),
		delete: getDeleteMethod<TFields>(),
	};

	return createBaseModel(options, staticMethods, instanceMethods);
}

const Table = {
	normal<TFields extends Record<string, FieldDefinition<unknown>>>(
		options: NormalTableOptions<TFields>,
	) {
		return defineTable({ ...options, type: "normal" });
	},
	relation<
		TIn extends FieldDefinition<unknown>,
		TOut extends FieldDefinition<unknown>,
		TOther extends Record<string, FieldDefinition<unknown>> = Record<
			string,
			never
		>,
	>(options: RelationTableOptions<TIn, TOut, TOther>) {
		return defineTable({ ...options, type: "relation" });
	},
} as const;

export { Table };
export default Table;

import type { TableDefineOptions } from "./types/model";

import type { FieldDefinition } from "../field/types";
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
import { getMergeMethod, getStaticMergeMethod } from "./crud/merge";

function defineTable<TFields extends Record<string, FieldDefinition<unknown>>>(
	options: TableDefineOptions<TFields>,
) {
	const staticMethods = {
		create: getCreateMethod<TFields>(),
		select: getSelectMethod<TFields>(),
		update: getStaticUpdateMethod<TFields>(),
		delete: getStaticDeleteMethod<TFields>(),
		merge: getStaticMergeMethod<TFields>(),
	};

	const instanceMethods = {
		update: getUpdateMethod<TFields>(),
		delete: getDeleteMethod<TFields>(),
		merge: getMergeMethod<TFields>(),
	};

	return createBaseModel(options, staticMethods, instanceMethods);
}

/**
 * A factory object for creating table model definitions.
 */
const Table = {
	/**
	 * Defines a standard (`NORMAL`) table model.
	 * Returns a base class that should be extended to create your final model.
	 *
	 * @param options Configuration for the normal table.
	 * @returns A base model class to be extended.
	 *
	 * @example
	 * ```ts
	 * import Table, { Field } from 'unreal-orm';
	 *
	 * class User extends Table.normal({
	 *   name: 'user',
	 *   schemafull: true,
	 *   fields: {
	 *     name: Field.string(),
	 *     email: Field.string({ assert: '$value CONTAINS "@"' }),
	 *     createdAt: Field.datetime({ default: () => new Date() }),
	 *   },
	 * }) {
	 *   // Custom methods are defined directly in the class body
	 *   getDisplayName() {
	 *     return `${this.name} <${this.email}>`;
	 *   }
	 * }
	 * ```
	 */
	normal<TFields extends Record<string, FieldDefinition<unknown>>>(
		options: NormalTableOptions<TFields>,
	) {
		return defineTable({ ...options, type: "normal" });
	},
	/**
	 * Defines a relation (`RELATION`) table model, also known as an edge.
	 * Returns a base class that should be extended.
	 *
	 * @param options Configuration for the relation table.
	 * @returns A base model class to be extended.
	 *
	 * @example
	 * ```ts
	 * import Table, { Field } from 'unreal-orm';
	 *
	 * // Assumes User and Post models are already defined.
	 * class Likes extends Table.relation({
	 *   name: 'likes',
	 *   schemafull: true,
	 *   fields: {
	 *     in: Field.record(() => User),
	 *     out: Field.record(() => Post),
	 *     timestamp: Field.datetime({ default: () => new Date() }),
	 *   },
	 * }) {}
	 * ```
	 */
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

import type {
	TableDefineOptions,
	ModelInstance,
	ModelStatic,
} from "./types/model";

import type { FieldDefinition } from "../field/types";
import type {
	NormalTableOptions,
	RelationTableFields,
	RelationTableOptions,
	ViewTableOptions,
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
	 *     email: Field.string({ assert: surql`$value CONTAINS "@"` }),
	 *     createdAt: Field.datetime({ default: surql`time::now()` }),
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
	 *     timestamp: Field.datetime({ default: surql`new datetime()` }),
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
	/**
	 * Defines a pre-computed table view (`DEFINE TABLE ... AS SELECT ...`).
	 * Returns a base class that should be extended.
	 *
	 * @param options Configuration for the view table.
	 * @returns A base model class to be extended.
	 *
	 * @example
	 * ```ts
	 * import { Table } from 'unreal-orm';
	 * import { surql } from 'surrealdb';
	 *
	 * type AdultUser = { name: string; age: number };
	 *
	 * class AdultUsers extends Table.view<AdultUser>({
	 *   name: 'adult_users',
	 *   as: surql`SELECT name, age FROM user WHERE age >= 18`,
	 * }) {}
	 * ```
	 */
	view<TResult extends Record<string, unknown> = Record<string, unknown>>(
		options: ViewTableOptions,
	) {
		const model = defineTable<Record<string, never>>({
			...options,
			type: "view",
			fields: {} as Record<string, never>,
		});

		type ViewInstance = ModelInstance<Record<string, never>> & TResult;

		return model as unknown as ModelStatic<
			ViewInstance,
			Record<string, never>,
			TableDefineOptions<Record<string, never>>
		>;
	},
} as const;

export { Table };
export default Table;

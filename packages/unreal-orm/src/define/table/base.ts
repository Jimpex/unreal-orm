import type { RecordId } from "surrealdb";
import type {
	InferShapeFromFields,
	ModelInstance,
	ModelStatic,
	TableDefineOptions,
} from "./types/model";
import type { FieldDefinition } from "../field/types";
import type { getCreateMethod } from "./crud/create";
import type { getSelectMethod } from "./crud/select";
import type { getUpdateMethod, getStaticUpdateMethod } from "./crud/update";
import type { getDeleteMethod, getStaticDeleteMethod } from "./crud/delete";
import type { getMergeMethod, getStaticMergeMethod } from "./crud/merge";
import { hydrate } from "./hydration";

/**
 * Creates the base class for a model, combining the schema definition with generated
 * static and instance CRUD methods. This function is the core of the `Table.define` factory.
 *
 * It dynamically constructs a class with the specified schema and methods, which can then be extended
 * by a user-defined class to create the final model.
 *
 * @param options The table definition options.
 * @param staticMethods An object containing the static CRUD methods (create, select, etc.).
 * @param instanceMethods An object containing the instance CRUD methods (update, delete).
 * @returns A dynamic base class that can be extended by the user to create a final model.
 * @internal
 */
export function createBaseModel<
	TFields extends Record<string, FieldDefinition<unknown>>,
>(
	options: TableDefineOptions<TFields>,
	staticMethods: {
		create: ReturnType<typeof getCreateMethod<TFields>>;
		select: ReturnType<typeof getSelectMethod<TFields>>;
		update: ReturnType<typeof getStaticUpdateMethod<TFields>>;
		delete: ReturnType<typeof getStaticDeleteMethod<TFields>>;
		merge: ReturnType<typeof getStaticMergeMethod<TFields>>;
	},
	instanceMethods: {
		update: ReturnType<typeof getUpdateMethod<TFields>>;
		delete: ReturnType<typeof getDeleteMethod<TFields>>;
		merge: ReturnType<typeof getMergeMethod<TFields>>;
	},
) {
	type TableData = InferShapeFromFields<TFields>;

	/**
	 * The internal base class for all models created by the ORM.
	 * It holds the schema definition and the core CRUD functionality.
	 * Users extend this class implicitly when using `Table.define`.
	 * @internal
	 */
	class DynamicModelBase {
		/** The unique record ID, assigned by the database. */
		id!: RecordId;

		/** @internal The name of the database table. */
		static readonly _tableName = options.name;
		/** @internal The field definitions for the table. */
		static readonly _fields = options.fields;
		/** @internal The original table definition options. */
		static readonly _options = options;

		/** @internal A property to hold any fields not explicitly defined in a flexible schema. */
		$dynamic: Record<string, unknown> = {};

		/** Returns the name of the database table. */
		static getTableName(): string {
			return options.name;
		}

		static create = staticMethods.create;
		static select = staticMethods.select;
		static update = staticMethods.update;
		static delete = staticMethods.delete;
		static merge = staticMethods.merge;

		/**
		 * Creates an instance of the model.
		 * This constructor takes the raw data from the database, assigns the `id`,
		 * and then calls the `hydrate` function to process and assign the rest of the data,
		 * including instantiating nested models for relations.
		 *
		 * @param data The raw data from the database, including the `id`.
		 */
		constructor(data: TableData & Record<string, unknown>) {
			if (data.id === undefined) {
				throw new Error(
					"DynamicModelBase constructor requires an 'id' in the data argument.",
				);
			}

			const fields = (this.constructor as typeof DynamicModelBase)._fields;
			const options = (this.constructor as typeof DynamicModelBase)._options;

			this.id = data.id as RecordId;
			Object.assign(this, data);

			hydrate(this as ModelInstance<TableData>, data, fields, options);
		}

		update = instanceMethods.update;
		delete = instanceMethods.delete;
		merge = instanceMethods.merge;
	}

	return DynamicModelBase as unknown as ModelStatic<
		ModelInstance<InferShapeFromFields<TFields>>,
		TFields,
		TableDefineOptions<TFields>
	>;
}

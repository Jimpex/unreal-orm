import type { RecordId } from "surrealdb";
import type {
	InferShapeFromFields,
	ModelInstance,
	ModelStatic,
	TableDefineOptions,
} from "./types/model";
import type { FieldDefinition } from "../../schema/field-definitions/definitions";
import type { getCreateMethod } from "./crud/create";
import type { getSelectMethod } from "./crud/select";
import type { getUpdateMethod, getStaticUpdateMethod } from "./crud/update";
import type { getDeleteMethod, getStaticDeleteMethod } from "./crud/delete";
import { hydrate } from "./hydration";

export function createBaseModel<
	TFields extends Record<string, FieldDefinition<unknown>>,
>(
	options: TableDefineOptions<TFields>,
	staticMethods: {
		create: ReturnType<typeof getCreateMethod<TFields>>;
		select: ReturnType<typeof getSelectMethod<TFields>>;
		update: ReturnType<typeof getStaticUpdateMethod<TFields>>;
		delete: ReturnType<typeof getStaticDeleteMethod<TFields>>;
	},
	instanceMethods: {
		update: ReturnType<typeof getUpdateMethod<TFields>>;
		delete: ReturnType<typeof getDeleteMethod<TFields>>;
	},
) {
	type TableData = InferShapeFromFields<TFields>;

	class DynamicModelBase {
		id!: RecordId;

		static readonly _tableName = options.name;
		static readonly _fields = options.fields;
		static readonly _options = options;

		$dynamic: Record<string, unknown> = {};

		static getTableName(): string {
			return options.name;
		}

		static create = staticMethods.create;
		static select = staticMethods.select;
		static update = staticMethods.update;
		static delete = staticMethods.delete;

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
	}

	return DynamicModelBase as unknown as ModelStatic<
		ModelInstance<InferShapeFromFields<TFields>>,
		TFields,
		TableDefineOptions<TFields>
	>;
}

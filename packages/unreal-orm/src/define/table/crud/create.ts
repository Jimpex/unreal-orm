import type { Surreal } from "surrealdb";
import type {
	ModelStatic,
	InferShapeFromFields,
	CreateData,
	ModelInstance,
	TableDefineOptions,
} from "../types/model";
import type { FieldDefinition } from "../../../schema/field-definitions/definitions";

export function getCreateMethod<
	TFields extends Record<string, FieldDefinition<unknown>>,
>() {
	type TableData = InferShapeFromFields<TFields>;
	type CreateInputData = InferShapeFromFields<TFields>;

	return async function create<
		T extends ModelStatic<
			ModelInstance<InferShapeFromFields<TFields>>,
			TFields,
			TableDefineOptions<TFields>
		>,
	>(this: T, db: Surreal, data: CreateData<TFields>): Promise<InstanceType<T>> {
		if (!db)
			throw new Error(
				"SurrealDB instance must be provided to create a record.",
			);

		const createdRecords = await db.create<CreateInputData>(
			this.getTableName(),
			data as CreateInputData,
		);
		const createdRecord = createdRecords[0] as TableData;
		const instance = new this(createdRecord) as InstanceType<T>;

		return instance;
	};
}

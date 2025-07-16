import type { RecordId, Surreal } from "surrealdb";
import type {
	InferShapeFromFields,
	ModelInstance,
	ModelStatic,
	TableDefineOptions,
} from "../types/model";
import type { FieldDefinition } from "../../../schema/field-definitions/definitions";

export function getUpdateMethod<
	TFields extends Record<string, FieldDefinition<unknown>>,
>() {
	type TableData = InferShapeFromFields<TFields>;
	type CreateInputData = InferShapeFromFields<TFields>;

	return async function update(
		this: ModelInstance<TableData>,
		db: Surreal,
		data: Partial<CreateInputData>,
	): Promise<ModelInstance<TableData>> {
		if (!db) {
			throw new Error(
				"SurrealDB instance must be provided to update a record.",
			);
		}

		const updatedRecord = await db.update<TableData>(
			this.id,
			data as TableData,
		);
		if (!updatedRecord) {
			throw new Error(`Failed to update record ${this.id}.`);
		}
		return new (
			this.constructor as new (
				data: TableData,
			) => ModelInstance<TableData>
		)(updatedRecord as TableData);
	};
}

export function getStaticUpdateMethod<
	TFields extends Record<string, FieldDefinition<unknown>>,
>() {
	type TableData = InferShapeFromFields<TFields>;

	return async function update<
		T extends ModelStatic<
			ModelInstance<InferShapeFromFields<TFields>>,
			TFields,
			TableDefineOptions<TFields>
		>,
	>(
		this: T,
		db: Surreal,
		id: RecordId,
		data: Partial<TableData>,
	): Promise<InstanceType<T>> {
		if (!db) {
			throw new Error(
				"SurrealDB instance must be provided to update a record.",
			);
		}

		const existingRecord = await db.select<TableData>(id);
		if (!existingRecord) {
			throw new Error(`Record with ID ${id} not found for update.`);
		}

		const updatedRecord = await db.update<TableData>(id, data as TableData);
		if (!updatedRecord) {
			throw new Error(`Failed to update record ${id}.`);
		}

		return new this(
			updatedRecord as TableData & { id: RecordId },
		) as InstanceType<T>;
	};
}

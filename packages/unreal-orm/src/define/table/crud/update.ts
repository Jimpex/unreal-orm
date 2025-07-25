import type { RecordId, Surreal } from "surrealdb";
import type {
	InferShapeFromFields,
	ModelInstance,
	ModelStatic,
	TableDefineOptions,
} from "../types/model";
import type { FieldDefinition } from "../../field/types";

/**
 * A factory function that generates the instance `update` method for a model.
 * This method performs a full record replacement (`UPDATE` in SurrealQL), replacing the entire
 * document with the provided data. All required fields must be included in the `data` object,
 * otherwise SurrealDB will throw an error.
 * 
 * For partial updates, use the `.merge()` method.
 *
 * @example
 * ```ts
 * const user = await User.select(db, 'user:123');
 * // Note: 'name' is a required field, so it must be included.
 * const updatedUser = await user.update(db, { name: 'Jane Doe', age: 31 });
 * ```
 *
 * @returns The instance `update` method implementation.
 * @internal
 */
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
		const ModelClass = this.constructor as ModelStatic<
			ModelInstance<TableData>,
			TFields,
			TableDefineOptions<TFields>
		>;
		return ModelClass.update(db, this.id, data);
	};
}

/**
 * A factory function that generates the static `update` method for a model.
 * This method performs a full record replacement (`UPDATE` in SurrealQL) for a given record ID,
 * replacing the entire document with the provided data. All required fields must be included in the `data` object,
 * otherwise SurrealDB will throw an error.
 * 
 * For partial updates, use the `.merge()` method.
 *
 * @example
 * ```ts
 * // Note: 'name' is a required field, so it must be included.
 * const updatedUser = await User.update(db, 'user:123', { name: 'Jane Doe', age: 31 });
 * ```
 *
 * @returns The static `update` method implementation.
 * @internal
 */
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

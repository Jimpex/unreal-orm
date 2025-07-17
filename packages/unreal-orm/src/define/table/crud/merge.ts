import type { RecordId, Surreal } from "surrealdb";
import type {
	InferShapeFromFields,
	ModelInstance,
	ModelStatic,
	TableDefineOptions,
} from "../types/model";
import type { FieldDefinition } from "../../field/types";

/**
 * A factory function that generates the instance `merge` method for a model.
 * This method performs a partial update on a record (`MERGE` in SurrealQL), changing only
 * the fields provided in the `data` object. This is the equivalent of a `PATCH` operation.
 * 
 * For a full document replacement, use the `.update()` method.
 *
 * @example
 * ```ts
 * const user = await User.select(db, 'user:123');
 * // This will only update the age, leaving the name unchanged.
 * const updatedUser = await user.merge(db, { age: 31 });
 * ```
 *
 * @returns The instance `merge` method implementation.
 * @internal
 */
export function getMergeMethod<
	TFields extends Record<string, FieldDefinition<unknown>>,
>() {
	type TableData = InferShapeFromFields<TFields>;
	type MergeInputData = Partial<InferShapeFromFields<TFields>>;

	return async function merge(
		this: ModelInstance<TableData>,
		db: Surreal,
		data: MergeInputData,
	): Promise<ModelInstance<TableData>> {
		const ModelClass = this.constructor as ModelStatic<
			ModelInstance<TableData>,
			TFields,
			TableDefineOptions<TFields>
		>;
		return ModelClass.merge(db, this.id, data);
	};
}

/**
 * A factory function that generates the static `merge` method for a model.
 * This method performs a partial update on a record (`MERGE` in SurrealQL) for a given record ID,
 * changing only the fields provided in the `data` object. This is the equivalent of a `PATCH` operation.
 * 
 * For a full document replacement, use the `.update()` method.
 *
 * @example
 * ```ts
 * // This will only update the age of user:123, leaving other fields unchanged.
 * const updatedUser = await User.merge(db, 'user:123', { age: 31 });
 * ```
 *
 * @returns The static `merge` method implementation.
 * @internal
 */
export function getStaticMergeMethod<
	TFields extends Record<string, FieldDefinition<unknown>>,
>() {
	type TableData = InferShapeFromFields<TFields>;

	return async function merge<
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
				"SurrealDB instance must be provided to merge a record.",
			);
		}

		const mergedRecord = await db.merge<TableData>(id, data as TableData);
		if (!mergedRecord) {
			throw new Error(`Failed to merge record ${id}.`);
		}

		return new this(
			mergedRecord as TableData & { id: RecordId },
		) as InstanceType<T>;
	};
}

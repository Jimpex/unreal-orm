import type { RecordId, Surreal } from "surrealdb";
import type {
	InferShapeFromFields,
	ModelInstance,
	ModelStatic,
	TableDefineOptions,
} from "../types/model";
import type { FieldDefinition } from "../../field/types";

/**
 * A factory function that generates the instance `delete` method for a model.
 * This method is responsible for deleting the current record from the database.
 *
 * @example
 * ```ts
 * const user = await User.select(db, 'user:123');
 * await user.delete(db);
 * ```
 *
 * @returns The instance `delete` method implementation.
 * @internal
 */
export function getDeleteMethod<
	TFields extends Record<string, FieldDefinition<unknown>>,
>() {
	type TableData = InferShapeFromFields<TFields>;

	return async function (
		this: ModelInstance<TableData>,
		db: Surreal,
	): Promise<void> {
		if (!db) {
			throw new Error(
				"SurrealDB instance must be provided to delete a record.",
			);
		}

		await db.delete(this.id);
	};
}

/**
 * A factory function that generates the static `delete` method for a model.
 * This method is responsible for deleting a record from the database by its ID.
 *
 * @example
 * ```ts
 * await User.delete(db, 'user:123');
 * ```
 *
 * @returns The static `delete` method implementation.
 * @internal
 */
export function getStaticDeleteMethod<
	TFields extends Record<string, FieldDefinition<unknown>>,
>() {
	return async function <
		T extends ModelStatic<
			ModelInstance<InferShapeFromFields<TFields>>,
			TFields,
			TableDefineOptions<TFields>
		>,
	>(this: T, db: Surreal, id: RecordId): Promise<void> {
		if (!db) {
			throw new Error(
				"SurrealDB instance must be provided to delete a record.",
			);
		}

		await db.delete(id);
	};
}

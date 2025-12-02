import type { RecordId, Surreal } from "surrealdb";
import type {
	InferShapeFromFields,
	ModelInstance,
	ModelStatic,
	TableDefineOptions,
	SurrealLike,
} from "../types/model";
import type { FieldDefinition } from "../../field/types";
import { getDatabase, isSurrealLike } from "../../../config";

/**
 * A factory function that generates the instance `delete` method for a model.
 * This method is responsible for deleting the current record from the database.
 *
 * Supports two calling patterns:
 * - `user.delete(db)` - explicit database instance
 * - `user.delete()` - uses configured default database
 *
 * @example
 * ```ts
 * const user = await User.select({ from: 'user:123', only: true });
 *
 * // With configured db
 * await user.delete();
 *
 * // With explicit db
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
		dbArg?: SurrealLike,
	): Promise<void> {
		// Resolve db based on calling pattern
		const db = dbArg ?? (await getDatabase());

		const ModelClass = this.constructor as ModelStatic<
			ModelInstance<TableData>,
			TFields,
			TableDefineOptions<TFields>
		>;
		await ModelClass.delete(db, this.id);
	};
}

/**
 * A factory function that generates the static `delete` method for a model.
 * This method is responsible for deleting a record from the database by its ID.
 *
 * Supports two calling patterns:
 * - `User.delete(db, id)` - explicit database instance
 * - `User.delete(id)` - uses configured default database
 *
 * @example
 * ```ts
 * // With configured db
 * await User.delete(recordId);
 *
 * // With explicit db
 * await User.delete(db, recordId);
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
	>(
		this: T,
		dbOrId: SurrealLike | RecordId,
		maybeId?: RecordId,
	): Promise<void> {
		// Resolve db and id based on calling pattern
		let db: SurrealLike;
		let id: RecordId;

		if (isSurrealLike(dbOrId)) {
			// Pattern: delete(db, id)
			db = dbOrId;
			id = maybeId as RecordId;
		} else {
			// Pattern: delete(id) - use configured default
			db = await getDatabase();
			id = dbOrId;
		}

		await db.delete(id);
	};
}

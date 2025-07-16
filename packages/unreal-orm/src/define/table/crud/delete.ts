import type { RecordId, Surreal } from "surrealdb";
import type {
	InferShapeFromFields,
	ModelInstance,
	ModelStatic,
	TableDefineOptions,
} from "../types/model";
import type { FieldDefinition } from "../../../schema/field-definitions/definitions";

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

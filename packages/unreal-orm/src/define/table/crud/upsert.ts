import type { RecordId } from "surrealdb";
import { Table, surql } from "surrealdb";
import { validateDb } from "../../../utils/validate-db";
import type { FieldDefinition } from "../../field/types";
import type {
	CreateData,
	InferShapeFromFields,
	ModelInstance,
	ModelStatic,
	SurrealLike,
	TableDefineOptions,
} from "../types/model";

/**
 * A factory function that generates the static `upsert` method for a model class.
 *
 * `UPSERT` works like `CREATE` but if a record with the same value for a unique index
 * already exists, it updates that record instead of creating a new one. This leverages
 * index-based lookup instead of a table scan, making it much more performant than
 * `UPDATE ... WHERE` on unique-indexed fields.
 *
 * @example
 * ```ts
 * // Create or update by unique email index
 * const user = await User.upsert(db, {
 *   data: { email: 'bob@bob.com', name: 'Bob Bobson' },
 * });
 *
 * // With explicit record ID
 * const user = await User.upsert(db, {
 *   id: 'user:bob',
 *   data: { email: 'bob@bob.com', name: 'Bob Bobson' },
 * });
 * ```
 *
 * @returns The static `upsert` method implementation.
 * @internal
 */
export function getUpsertMethod<
	TFields extends Record<string, FieldDefinition<unknown>>,
>() {
	type TableData = InferShapeFromFields<TFields>;

	return async function upsert<
		T extends ModelStatic<
			ModelInstance<InferShapeFromFields<TFields>>,
			TFields,
			TableDefineOptions<TFields>
		>,
	>(
		this: T,
		db: SurrealLike,
		options: {
			data: CreateData<TFields>;
			id?: RecordId;
		},
	): Promise<InstanceType<T>> {
		validateDb(db);

		const tableName = this.getTableName();
		const { id, ...rest } = options.data;

		const target = options.id ? options.id : new Table(tableName);

		const query = surql<
			[TableData[]]
		>`UPSERT ${target} CONTENT ${rest} RETURN AFTER`;

		const result = await db.query(query).collect();
		const record = result[0]?.[0];
		if (!record) {
			throw new Error(`Failed to upsert record in table ${tableName}`);
		}

		return new this(record) as InstanceType<T>;
	};
}

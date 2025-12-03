import type { Surreal } from "surrealdb";
import { Table, RecordId } from "surrealdb";
import type {
	ModelStatic,
	InferShapeFromFields,
	CreateData,
	ModelInstance,
	TableDefineOptions,
	SurrealLike,
} from "../types/model";
import type { FieldDefinition } from "../../field/types";
import { getDatabase, isSurrealLike } from "../../../config";

/**
 * A factory function that generates the static `create` method for a model class.
 * This is an internal helper used by the `createBaseModel` function to equip models
 * with their core CRUD functionality.
 *
 * The generated method creates a record in the database and returns a new, hydrated model instance.
 *
 * Supports two calling patterns:
 * - `User.create(db, data)` - explicit database instance
 * - `User.create(data)` - uses configured default database
 *
 * @example
 * ```ts
 * // With configured db
 * const user = await User.create({ name: 'John Doe', email: 'john@example.com' });
 *
 * // With explicit db
 * const user = await User.create(db, { name: 'John Doe', email: 'john@example.com' });
 * console.log(user.id); // RecordId('user:...')
 * ```
 *
 * @returns The static `create` method implementation.
 * @internal
 */
export function getCreateMethod<
	TFields extends Record<string, FieldDefinition<unknown>>,
>() {
	type TableData = InferShapeFromFields<TFields>;

	// Type for relation table data with required in/out RecordId fields
	type RelationCreateData = {
		in: RecordId;
		out: RecordId;
		[key: string]: unknown;
	};

	return async function create<
		T extends ModelStatic<
			ModelInstance<InferShapeFromFields<TFields>>,
			TFields,
			TableDefineOptions<TFields>
		>,
	>(
		this: T,
		dbOrData: SurrealLike | CreateData<TFields>,
		maybeData?: CreateData<TFields>,
	): Promise<InstanceType<T>> {
		// Resolve db and data based on calling pattern
		let db: SurrealLike;
		let data: CreateData<TFields>;

		if (isSurrealLike(dbOrData)) {
			// Pattern: create(db, data)
			db = dbOrData;
			if (maybeData === undefined) {
				throw new Error(
					"create(db, data) requires data as second argument. " +
						"Did you mean to use create(data) with a configured database?",
				);
			}
			data = maybeData;
		} else {
			// Pattern: create(data) - use configured default
			db = await getDatabase();
			if (dbOrData === undefined || dbOrData === null) {
				throw new Error("create(data) requires data object");
			}
			data = dbOrData;
		}

		let createdRecord: { [key: string]: unknown };
		if (this._options.type === "relation") {
			// For relation tables, validate and use the relate API with in/out/from/to data
			const relationData = data as RelationCreateData;

			// Validate that in and out are RecordId instances
			if (!relationData.in || !relationData.out) {
				throw new Error("Relation tables require 'in' and 'out' properties");
			}

			if (!(relationData.in instanceof RecordId)) {
				throw new Error("'in' property must be a RecordId instance");
			}

			if (!(relationData.out instanceof RecordId)) {
				throw new Error("'out' property must be a RecordId instance");
			}

			createdRecord = await db.relate(
				relationData.in,
				new Table(this.getTableName()),
				relationData.out,
				relationData,
			);
		} else {
			// For normal tables, use query-based create to avoid Table class module issues
			// The SurrealDB SDK's builder API (db.create().content()) doesn't work across
			// different package versions due to class identity checks on Table/BoundQuery
			const tableName = this.getTableName();
			const queryStr = "CREATE type::table($table) CONTENT $data RETURN AFTER";
			const bindings = { table: tableName, data };

			// Call query with string and bindings, then collect results
			const queryBuilder = (db as unknown as Surreal).query(queryStr, bindings);
			const result = (await queryBuilder.collect()) as unknown as [
				Record<string, unknown>[],
			];
			const record = result[0]?.[0];
			if (!record) {
				throw new Error(`Failed to create record in table ${tableName}`);
			}
			createdRecord = record;
		}
		const instance = new this(createdRecord as TableData) as InstanceType<T>;

		return instance;
	};
}

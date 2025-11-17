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

/**
 * A factory function that generates the static `create` method for a model class.
 * This is an internal helper used by the `createBaseModel` function to equip models
 * with their core CRUD functionality.
 *
 * The generated method takes a Surreal instance and the record data, creates the
 * record in the database, and returns a new, hydrated model instance.
 *
 * @example
 * ```ts
 * // This is not called directly, but is used by the ORM to generate:
 * const user = await User.create(db, { name: 'John Doe', email: 'john.doe@example.com' });
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
	type CreateInputData = InferShapeFromFields<TFields>;

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
		db: SurrealLike,
		data: CreateData<TFields>,
	): Promise<InstanceType<T>> {
		if (!db)
			throw new Error(
				"SurrealDB instance must be provided to create a record.",
			);

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
			// For normal tables, use the new create builder pattern
			const createdRecords = await db
				.create(new Table(this.getTableName()))
				.content(data as CreateInputData);
			createdRecord = createdRecords[0] as { [key: string]: unknown };
		}
		const instance = new this(createdRecord as TableData) as InstanceType<T>;

		return instance;
	};
}

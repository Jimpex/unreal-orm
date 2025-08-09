import type { Surreal } from "surrealdb";
import type {
	ModelStatic,
	InferShapeFromFields,
	CreateData,
	ModelInstance,
	TableDefineOptions,
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

		let createdRecords: { [key: string]: unknown }[];
		if (this._options.type === "relation") {
			createdRecords = await db.insertRelation(
				this.getTableName(),
				data as CreateInputData,
			);
		} else {
			createdRecords = await db.create<CreateInputData>(
				this.getTableName(),
				data as CreateInputData,
			);
		}

		const createdRecord = createdRecords[0] as TableData;
		const instance = new this(createdRecord) as InstanceType<T>;

		return instance;
	};
}

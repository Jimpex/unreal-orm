import { RecordId, Table, surql } from "surrealdb";
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
 * A factory function that generates the static `create` method for a model class.
 * This is an internal helper used by the `createBaseModel` function to equip models
 * with their core CRUD functionality.
 *
 * The generated method creates a record in the database and returns a new, hydrated model instance.
 *
 * @example
 * ```ts
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
		validateDb(db);

		const tableName = this.getTableName();

		// Relation tables require explicit in/out RecordIds and use RELATE
		if (this._options.type === "relation") {
			const { id, in: inId, out: outId, ...relationRest } = data;

			if (!(inId instanceof RecordId) || !(outId instanceof RecordId)) {
				throw new Error(
					`Relation table "${tableName}" requires 'in' and 'out' RecordId fields.`,
				);
			}

			const edge = id ? id : new Table(tableName);

			const query = surql<
				[TableData[]]
			>`RELATE ${inId}->${edge}->${outId} CONTENT ${relationRest} RETURN AFTER`;

			const result = await db.query(query).collect();
			const record = result[0]?.[0];
			if (!record) {
				throw new Error(`Failed to create relation in table ${tableName}`);
			}

			return new this(record) as InstanceType<T>;
		}

		const { id, ...rest } = data;

		const target = id ? id : new Table(tableName);

		const query = surql<
			[TableData[]]
		>`CREATE ${target} CONTENT ${rest} RETURN AFTER`;

		const result = await db.query(query).collect();
		const record = result[0]?.[0];
		if (!record) {
			throw new Error(`Failed to create record in table ${tableName}`);
		}

		return new this(record) as InstanceType<T>;
	};
}

/**
 * A factory function that generates the static `relate` method for relation/edge models.
 * Generates a `RELATE` statement with optional `OR UPDATE` and custom edge IDs.
 *
 * @example
 * ```ts
 * const follow = await Follow.relate(db, {
 *   from: user.id,
 *   to: post.id,
 *   data: { since: new Date() },
 *   orUpdate: true,
 * });
 * ```
 *
 * @returns The static `relate` method implementation.
 * @internal
 */
export function getRelateMethod<
	TFields extends Record<string, FieldDefinition<unknown>>,
>() {
	type TableData = InferShapeFromFields<TFields>;

	return async function relate<
		T extends ModelStatic<
			ModelInstance<InferShapeFromFields<TFields>>,
			TFields,
			TableDefineOptions<TFields>
		>,
	>(
		this: T,
		db: SurrealLike,
		options: {
			from: RecordId;
			to: RecordId;
			data?: Record<string, unknown>;
			orUpdate?: boolean;
			id?: RecordId;
		},
	): Promise<InstanceType<T>> {
		validateDb(db);

		if (this._options.type !== "relation") {
			throw new Error(
				`relate() can only be called on relation tables. Table "${this.getTableName()}" is not a relation table.`,
			);
		}

		const tableName = this.getTableName();
		const edge = options.id ? options.id : new Table(tableName);

		const orUpdateClause = options.orUpdate ? " OR UPDATE" : "";
		const content = options.data ?? {};

		const query = surql<
			[TableData[]]
		>`RELATE${orUpdateClause} ${options.from}->${edge}->${options.to} CONTENT ${content}`;

		const result = await db.query(query).collect();
		const record = result[0]?.[0];
		if (!record) {
			throw new Error(`Failed to create relation in table ${tableName}`);
		}

		return new this(record) as InstanceType<T>;
	};
}

import type { Expr, RecordId } from "surrealdb";
import { BoundQuery, Table, surql } from "surrealdb";
import type { FieldProxy } from "../../../query/field-proxy";
import { createFieldProxy } from "../../../query/field-proxy";
import { validateDb } from "../../../utils/validate-db";
import type { FieldDefinition } from "../../field/types";
import type {
	InferShapeFromFields,
	ModelInstance,
	ModelStatic,
	SurrealLike,
	TableDefineOptions,
} from "../types/model";

/**
 * A factory function that generates the instance `delete` method for a model.
 * This method is responsible for deleting the current record from the database.
 *
 * @example
 * ```ts
 * const user = await User.select(db, { from: 'user:123', only: true });
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
		db: SurrealLike,
	): Promise<void> {
		validateDb(db);

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
 * @example
 * ```ts
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
	>(this: T, db: SurrealLike, id: RecordId): Promise<void> {
		validateDb(db);

		await db.delete(id);
	};
}

// ============================================================================
// BULK DELETE METHOD
// ============================================================================

/**
 * A factory function that generates the static `deleteMany` method for a model.
 * Deletes every record matching the given WHERE clause.
 *
 * @example
 * ```ts
 * await User.deleteMany(db, { where: eq('active', false) });
 * ```
 *
 * @returns The static `deleteMany` method implementation.
 * @internal
 */
export function getDeleteManyMethod<
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
		db: SurrealLike,
		options: {
			where:
				| BoundQuery
				| Expr
				| ((fields: FieldProxy<TFields>) => BoundQuery | Expr);
		},
	): Promise<void> {
		validateDb(db);

		const tableName = this.getTableName();
		let whereQuery: BoundQuery;

		if (typeof options.where === "function") {
			const proxy = createFieldProxy(this._fields);
			whereQuery = surql`${options.where(proxy as FieldProxy<TFields>)}`;
		} else if (
			options.where &&
			typeof options.where === "object" &&
			"query" in options.where &&
			"bindings" in options.where
		) {
			whereQuery = options.where as BoundQuery;
		} else {
			whereQuery = surql`${options.where as Expr}`;
		}

		// Build DELETE query manually so the table name is bound safely.
		const sqlString = `DELETE type::table($table) WHERE ${whereQuery.query}`;
		const query = new BoundQuery(sqlString, {
			table: tableName,
			...whereQuery.bindings,
		});

		await db.query(query.query, query.bindings).collect();
	};
}

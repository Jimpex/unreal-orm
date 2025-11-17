// User-facing schema option types for Unreal-ORM

import type { FieldDefinition } from "../define/field/types.ts";
import type { BoundQuery, Expr } from "surrealdb";

/**
 * Defines a SurrealDB permissions clause for a table or field.
 * The value for each property should be a valid SurrealQL `WHERE` clause, BoundQuery, or Expr.
 *
 * @example
 * ```ts
 * const permissions = {
 *   // Only the record owner or an admin can select
 *   select: surql`owner = $auth.id OR "admin" IN $auth.tags`,
 *   // Any authenticated user can create
 *   create: surql`$auth.id != NONE`,
 *   // Only the owner can update or delete
 *   update: surql`owner = $auth.id`,
 *   delete: surql`owner = $auth.id`,
 * };
 * ```
 */
export interface PermissionsClause {
	/** A SurrealQL `WHERE` clause for `SELECT` permissions. */
	select?: BoundQuery | Expr;
	/** A SurrealQL `WHERE` clause for `CREATE` permissions. */
	create?: BoundQuery | Expr;
	/** A SurrealQL `WHERE` clause for `UPDATE` permissions. */
	update?: BoundQuery | Expr;
	/** A SurrealQL `WHERE` clause for `DELETE` permissions. */
	delete?: BoundQuery | Expr;
}

/** Permissions for a specific field. */
export type FieldPermissionsOptions = PermissionsClause;
/** Permissions for an entire table. */
export type TablePermissionsOptions = PermissionsClause;

/**
 * Configuration for a SurrealDB table changefeed.
 * @see https://surrealdb.com/docs/surrealql/statements/define/table#change-feeds
 *
 * @example
 * ```ts
 * const changefeedConfig = {
 *   duration: '3d', // Keep changes for 3 days
 *   includeOriginal: true, // Include the original record in the feed
 * };
 * ```
 */
export interface ChangefeedConfig {
	/** The duration for which the changefeed will store data (e.g., '1h', '3d'). */
	duration: string;
	/** If true, the original record data is included in the changefeed message. */
	includeOriginal?: boolean;
}

/**
 * Options for defining a standard (`NORMAL`) table.
 */
export interface NormalTableOptions<
	TFields extends Record<string, FieldDefinition<unknown>>,
> {
	/** The name of the table in the database. */
	name: string;
	/** An object defining the fields for the table. */
	fields: TFields;
	/** If true, the table will be defined as `SCHEMAFULL`. Defaults to `false`. */
	schemafull?: boolean;
	/** Table-level permissions. */
	permissions?: TablePermissionsOptions;
	/** Configuration for the table's changefeed. */
	changefeed?: ChangefeedConfig;
	/** A comment to add to the table definition in SurrealDB. */
	comment?: string;
}

/**
 * Defines the fields for a relation (edge) table, including the required `in` and `out` fields.
 */
export type RelationTableFields<
	TIn extends FieldDefinition<unknown>,
	TOut extends FieldDefinition<unknown>,
	TOther extends Record<string, FieldDefinition<unknown>> = Record<
		string,
		never
	>,
> = TOther & {
	/** The incoming side of the relation. */
	in: TIn;
	/** The outgoing side of the relation. */
	out: TOut;
};

/**
 * Options for defining a relation (`RELATION`) table.
 */
export interface RelationTableOptions<
	TIn extends FieldDefinition<unknown>,
	TOut extends FieldDefinition<unknown>,
	TOther extends Record<string, FieldDefinition<unknown>> = Record<
		string,
		never
	>,
> extends Omit<
		NormalTableOptions<RelationTableFields<TIn, TOut, TOther>>,
		"fields"
	> {
	/** An object defining the fields for the relation, including `in` and `out`. */
	fields: RelationTableFields<TIn, TOut, TOther>;
}

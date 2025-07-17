import type { AnyModelClass } from "../table/types/model";

/**
 * Defines the structure of a database index.
 * @internal
 * @example
 * ```ts
 * const userEmailIndex: IndexDefinition = {
 *   _type: 'index',
 *   name: 'user_email_idx',
 *   table: User,
 *   fields: ['email'],
 *   unique: true
 * };
 * ```
 */
export interface IndexDefinition {
	/** @internal A type identifier for the index definition. */
	_type: "index";
	/** The name of the index. */
	name: string;
	/** The model class the index belongs to. */
	table: AnyModelClass;
	/** The fields to be included in the index. */
	fields: string[];
	/** If true, creates a unique index. */
	unique?: boolean;
	/** The search analyzer to use for the index. */
	analyzer?: string;
	/** A comment describing the index. */
	comment?: string;
}

/**
 * Defines the options for creating an index definition.
 * This is a subset of `IndexDefinition`, excluding internal properties that are handled by the ORM.
 * @example
 * ```ts
 * const nameIndex: IndexDefineOptions = {
 *   name: 'user_name_idx',
 *   fields: ['name']
 * };
 * ```
 */
export type IndexDefineOptions = Omit<IndexDefinition, "table" | "_type">;

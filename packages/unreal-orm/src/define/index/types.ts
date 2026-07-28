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
	/** The fields to be included in the index. Not required for COUNT indexes. */
	fields?: string[];
	/** If true, creates a unique index. */
	unique?: boolean;
	/** If true, creates a COUNT index that maintains a running total for fast `count()` queries. */
	count?: boolean;
	/** If true, creates the index concurrently without blocking other operations. */
	concurrently?: boolean;
	/** If true, defers index updates to a background queue for high-throughput ingestion. Cannot be used with unique indexes. */
	defer?: boolean;
	/** If true, creates a full-text search index. */
	search?: boolean;
	/** The search analyzer to use for a full-text search index. */
	analyzer?: string;
	/** Whether to enable BM25 ranking for full-text search. */
	bm25?: boolean;
	/** Whether to enable keyword highlighting for full-text search. */
	highlights?: boolean;
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

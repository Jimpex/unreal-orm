/**
 * @file This is the main entry point for the unreal-orm package.
 * It exports the public API for defining tables, fields, indexes, and executing queries.
 * @module unreal-orm
 */

// #region Main API

/**
 * Unified namespace for ORM configuration, schema utilities, and database access.
 * Provides a clean API surface for common operations.
 *
 * @example
 * ```ts
 * import { Unreal, Table, Field } from "unreal-orm";
 *
 * Unreal.configure({ getDatabase });
 * await Unreal.applySchema(db, [User, Post]);
 * ```
 *
 * @see {@link ./unreal.ts}
 */
export { Unreal } from "./unreal";

/**
 * The primary interface for defining database tables and their associated models.
 * @see {@link ./define/table/index.ts}
 */
export { default as Table } from "./define/table";

/**
 * A collection of static methods for defining field types (e.g., `Field.string()`, `Field.number()`).
 * @see {@link ./schema/field-definitions/builders.ts}
 */
export { Field } from "./define/field";

/**
 * Functions for generating and applying the full database schema from all defined tables and indexes.
 * @see {@link ./schema/generator.ts}
 */
export {
	applySchema,
	generateFullSchemaQl,
	generateTableSchemaQl,
} from "./schema/generator";

/**
 * The primary interface for defining database indexes on tables.
 * @see {@link ./define/index/index.ts}
 */
export { Index } from "./define/index";

/**
 * The primary interface for defining file storage buckets.
 * Requires SurrealDB to be started with `--allow-experimental files`.
 * @see {@link ./define/bucket/index.ts}
 */
export { Bucket } from "./define/bucket";

/**
 * Schema AST - bidirectional schema transformation.
 * Enables programmatic schema comparison, migration generation, and introspection.
 * @see {@link ./schema/ast/index.ts}
 */
export {
	// Parser
	parseTableDefinition,
	parseFieldDefinition,
	parseIndexDefinition,
	parseBucketDefinition,
	extractTableName,
	// Extractor
	extractSchemaFromDefinables,
	extractTableFromModel,
	extractIndexFromDefinition,
	extractBucketFromDefinition,
	isModelClass,
	isIndexDefinition,
	isBucketDefinition,
	// Compare
	compareSchemas,
	schemasAreEqual,
	groupChangesByTable,
	filterChangesByType,
	// Generator
	generateSurqlFromAST,
	generateMigrationSurql,
	generateBucketDdl,
	generateBucketAlter,
} from "./schema/ast";

export type {
	// Types
	SchemaAST,
	TableAST,
	FieldAST,
	IndexAST,
	EventAST,
	PermissionsAST,
	TableType,
	BucketAST,
	// Compare types
	ChangeType,
	SchemaChange,
	// Generator types
	SchemaApplicationMethod,
} from "./schema/ast";

// #endregion

// #region Query Builder

/**
 * Type-safe SurrealQL expression builder. Use these helpers inside `where` callbacks
 * on `select`, `count`, `updateMany`, and `deleteMany`.
 */
export {
	createFieldProxy,
	and,
	or,
	not,
	eq,
	ne,
	gt,
	gte,
	lt,
	lte,
	exact,
	isNone,
	isNotNone,
	isNull,
	isNotNull,
	isTrue,
	isFalse,
	inside,
	outside,
	intersects,
	matches,
	isIn,
	isNotIn,
	containsAny,
	containsAll,
	containsNone,
	add,
	subtract,
	multiply,
	divide,
	modulo,
	out,
	in_,
	in_ as in,
	both,
	count,
	sum,
	avg,
	min,
	max,
	countIn,
	countOut,
} from "./query/field-proxy";
export { Range, RangeId, NONE, UNBOUNDED } from "./query/range";
export type {
	ColumnRef,
	StringColumn,
	NumberColumn,
	DateTimeColumn,
	ArrayColumn,
	FieldProxy,
	FunctionNamespace,
	StringNamespace,
	MathNamespace,
	ArrayNamespace,
	TimeNamespace,
	MetaNamespace,
	RecordNamespace,
	TypeNamespace,
} from "./query/field-proxy";

// #endregion

// #region Type Definitions

/**
 * Core types related to field definitions and their options.
 */
export type { FieldDefinition, FieldOptions } from "./define/field/types";

/**
 * The type definition for a database index.
 */
export type { IndexDefinition, IndexDefineOptions } from "./define/index/types";

/**
 * Type definitions for bucket definitions and their options.
 */
export type { BucketDefinition, BucketOptions } from "./define/bucket/types";

/**
 * Types for constructing and executing `SELECT`, `INSERT`, `UPDATE`, and `COUNT` queries.
 */
export type {
	OrderByClause,
	SelectQueryOptions,
	InsertQueryOptions,
	ReturnType,
	UpdateOptions,
	UpdateMode,
	StandardUpdateOptions,
	PatchUpdateOptions,
	SetUpdateOptions,
	UpdateOptionsForMode,
	JsonPatchOperation,
	CountQueryOptions,
} from "./define/table/types/query";

/**
 * Type-safe field selection for SELECT queries.
 */
export { typed } from "./define/table/types/select";
export type {
	TypedExpr,
	FieldSelect,
	SelectOption,
	OmitSelect,
	InferSelectResult,
	InferOmitResult,
} from "./define/table/types/select";

/**
 * Core types representing the static and instance side of a model,
 * and a utility type for inferring the data shape from field definitions.
 */
export type {
	ModelStatic,
	ModelInstance,
	InferShapeFromFields,
	AnyModelClass,
	SurrealLike,
} from "./define/table/types/model";

// #endregion

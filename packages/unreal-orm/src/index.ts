/**
 * @file This is the main entry point for the unreal-orm package.
 * It exports the public API for defining tables, fields, indexes, and executing queries.
 * @module unreal-orm
 */

// #region Main API

/**
 * The primary interface for defining file storage buckets.
 * Requires SurrealDB to be started with `--allow-experimental files`.
 * @see {@link ./define/bucket/index.ts}
 */
export { Bucket } from "./define/bucket";
/**
 * A collection of static methods for defining field types (e.g., `Field.string()`, `Field.number()`).
 * @see {@link ./schema/field-definitions/builders.ts}
 */
export { Field } from "./define/field";
/**
 * The primary interface for defining database indexes on tables.
 * @see {@link ./define/index/index.ts}
 */
export { Index } from "./define/index";
/**
 * The primary interface for defining database tables and their associated models.
 * @see {@link ./define/table/index.ts}
 */
export { default as Table } from "./define/table";
export type {
	BucketAST,
	// Compare types
	ChangeType,
	EventAST,
	FieldAST,
	IndexAST,
	PermissionsAST,
	// Generator types
	SchemaApplicationMethod,
	// Types
	SchemaAST,
	SchemaChange,
	TableAST,
	TableType,
} from "./schema/ast";
/**
 * Schema AST - bidirectional schema transformation.
 * Enables programmatic schema comparison, migration generation, and introspection.
 * @see {@link ./schema/ast/index.ts}
 */
export {
	// Compare
	compareSchemas,
	extractBucketFromDefinition,
	extractIndexFromDefinition,
	// Extractor
	extractSchemaFromDefinables,
	extractTableFromModel,
	extractTableName,
	filterChangesByType,
	generateBucketAlter,
	generateBucketDdl,
	generateMigrationSurql,
	// Generator
	generateSurqlFromAST,
	groupChangesByTable,
	isBucketDefinition,
	isIndexDefinition,
	isModelClass,
	parseBucketDefinition,
	parseFieldDefinition,
	parseIndexDefinition,
	// Parser
	parseTableDefinition,
	schemasAreEqual,
} from "./schema/ast";
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

// #endregion

// #region Query Builder

export type {
	ArrayColumn,
	ArrayNamespace,
	ColumnRef,
	DateTimeColumn,
	FieldProxy,
	FunctionNamespace,
	MathNamespace,
	MetaNamespace,
	NumberColumn,
	RecordNamespace,
	StringColumn,
	StringNamespace,
	TimeNamespace,
	TypeNamespace,
} from "./query/field-proxy";
/**
 * Type-safe SurrealQL expression builder. Use these helpers inside `where` callbacks
 * on `select`, `count`, `updateMany`, and `deleteMany`.
 */
export {
	add,
	and,
	avg,
	both,
	containsAll,
	containsAny,
	containsNone,
	count,
	countIn,
	countOut,
	createFieldProxy,
	divide,
	eq,
	exact,
	gt,
	gte,
	in_,
	in_ as in,
	inside,
	intersects,
	isFalse,
	isIn,
	isNone,
	isNotIn,
	isNotNone,
	isNotNull,
	isNull,
	isTrue,
	lt,
	lte,
	matches,
	max,
	min,
	modulo,
	multiply,
	ne,
	not,
	or,
	out,
	outside,
	subtract,
	sum,
} from "./query/field-proxy";
export { NONE, Range, RangeId, UNBOUNDED } from "./query/range";

// #endregion

// #region Type Definitions

/**
 * Type definitions for bucket definitions and their options.
 */
export type { BucketDefinition, BucketOptions } from "./define/bucket/types";
/**
 * Core types related to field definitions and their options.
 */
export type { FieldDefinition, FieldOptions } from "./define/field/types";
/**
 * The type definition for a database index.
 */
export type {
	IndexDefineOptions,
	IndexDefinition,
	VectorDistance,
	VectorElementType,
	VectorIndexOptions,
	VectorType,
} from "./define/index/types";
/**
 * Core types representing the static and instance side of a model,
 * and a utility type for inferring the data shape from field definitions.
 */
export type {
	AnyModelClass,
	InferShapeFromFields,
	ModelInstance,
	ModelStatic,
	SurrealLike,
} from "./define/table/types/model";
/**
 * Types for constructing and executing `SELECT`, `INSERT`, `UPDATE`, and `COUNT` queries.
 */
export type {
	CountQueryOptions,
	InsertQueryOptions,
	JsonPatchOperation,
	OrderByClause,
	PatchUpdateOptions,
	ReturnType,
	SelectQueryOptions,
	SetUpdateOptions,
	StandardUpdateOptions,
	UpdateMode,
	UpdateOptions,
	UpdateOptionsForMode,
} from "./define/table/types/query";
export type {
	FieldSelect,
	InferOmitResult,
	InferSelectResult,
	OmitSelect,
	SelectOption,
	TypedExpr,
} from "./define/table/types/select";
/**
 * Type-safe field selection for SELECT queries.
 */
export { typed } from "./define/table/types/select";

// #endregion

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
 * Configuration functions for global database setup.
 * Enables using ORM methods without passing db explicitly.
 * @see {@link ./config/index.ts}
 */
export {
	configure,
	getDatabase,
	hasDatabase,
	clearConfig,
	isSurrealLike,
} from "./config";
export type { ConfigureOptions } from "./config";

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
	extractTableName,
	// Extractor
	extractSchemaFromDefinables,
	extractTableFromModel,
	extractIndexFromDefinition,
	isModelClass,
	isIndexDefinition,
	// Compare
	compareSchemas,
	schemasAreEqual,
	groupChangesByTable,
	filterChangesByType,
	// Generator
	generateSurqlFromAST,
	generateMigrationSurql,
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
	// Compare types
	ChangeType,
	SchemaChange,
	// Generator types
	SchemaApplicationMethod,
} from "./schema/ast";

// #endregion

// #region Type Definitions

/**
 * Core types related to field definitions and their options.
 */
export type { FieldDefinition, FieldOptions } from "./define/field/types";

/**
 * The type definition for a database index.
 */
export type { IndexDefinition } from "./define/index/types";

/**
 * Types for constructing and executing `SELECT`, `UPDATE`, and `COUNT` queries.
 */
export type {
	OrderByClause,
	SelectQueryOptions,
	UpdateOptions,
	UpdateMode,
	StandardUpdateOptions,
	PatchUpdateOptions,
	UpdateOptionsForMode,
	JsonPatchOperation,
	CountQueryOptions,
} from "./define/table/types/query";

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

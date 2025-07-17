/**
 * @file This is the main entry point for the unreal-orm package.
 * It exports the public API for defining tables, fields, indexes, and executing queries.
 * @module unreal-orm
 */

// #region Main API

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
export { applySchema, generateFullSchemaQl } from "./schema/generator";

/**
 * The primary interface for defining database indexes on tables.
 * @see {@link ./define/index/index.ts}
 */
export { Index } from "./define/index";

// #endregion

// #region Type Definitions

/**
 * Core types related to field definitions and their options.
 */
export type {
	FieldDefinition,
	FieldOptions,
} from "./define/field/types";

/**
 * The type definition for a database index.
 */
export type { IndexDefinition } from "./define/index/types";

/**
 * Types for constructing and executing `SELECT` and `COUNT` queries.
 */
export type {
	OrderByClause,
	SelectQueryOptions,
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
} from "./define/table/types/model";

// #endregion

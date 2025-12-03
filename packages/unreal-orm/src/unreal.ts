/**
 * Unreal Namespace
 *
 * A unified namespace for ORM configuration, schema utilities, and database access.
 * Provides a clean API surface for common operations.
 *
 * @example
 * ```ts
 * import { Unreal, Table, Field } from "unreal-orm";
 *
 * // Configure database connection
 * Unreal.configure({ getDatabase });
 *
 * // Apply schema to database
 * await Unreal.applySchema(db, [User, Post, Follow]);
 *
 * // Generate schema DDL
 * const ddl = Unreal.generateSchema([User, Post]);
 * ```
 *
 * @module
 */

import {
	configure,
	getDatabase,
	hasDatabase,
	clearConfig,
	type ConfigureOptions,
} from "./config";

import { applySchema, generateFullSchemaQl } from "./schema/generator";

import {
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

import type { SurrealLike } from "./define/table/types/model";
import type { SchemaAST, SchemaChange } from "./schema/ast";

/**
 * The Unreal namespace provides a unified API for:
 * - **Configuration**: Database connection setup
 * - **Schema**: DDL generation and application
 * - **AST**: Schema parsing, comparison, and migration
 */
export const Unreal = {
	// =========================================================================
	// CONFIGURATION
	// =========================================================================

	/**
	 * Configure the global database connection.
	 * After calling this, ORM methods can be used without passing `db` explicitly.
	 *
	 * @example
	 * ```ts
	 * // With factory function (recommended)
	 * Unreal.configure({ getDatabase: () => connectToDatabase() });
	 *
	 * // With pre-connected instance
	 * Unreal.configure({ database: db });
	 * ```
	 */
	configure,

	/**
	 * Get the configured database instance.
	 * @throws Error if no database is configured
	 */
	getDatabase,

	/**
	 * Check if a database is configured.
	 */
	hasDatabase,

	/**
	 * Clear the global database configuration.
	 * Useful for testing or switching connections.
	 */
	clearConfig,

	// =========================================================================
	// SCHEMA - Generation & Application
	// =========================================================================

	/**
	 * Apply schema definitions to the database.
	 * Creates/updates tables, fields, and indexes.
	 *
	 * @example
	 * ```ts
	 * await Unreal.applySchema(db, [User, Post, idx_user_email]);
	 * ```
	 */
	applySchema,

	/**
	 * Generate full SurrealQL schema from definitions.
	 *
	 * @example
	 * ```ts
	 * const ddl = Unreal.generateSchema([User, Post]);
	 * console.log(ddl);
	 * // DEFINE TABLE user SCHEMAFULL;
	 * // DEFINE FIELD email ON user TYPE string;
	 * // ...
	 * ```
	 */
	generateSchema: generateFullSchemaQl,

	// =========================================================================
	// AST - Parsing & Introspection
	// =========================================================================

	/**
	 * AST utilities for schema parsing, comparison, and migration.
	 */
	ast: {
		// Parsing SurrealQL strings
		/**
		 * Parse a DEFINE TABLE statement into AST.
		 */
		parseTable: parseTableDefinition,

		/**
		 * Parse a DEFINE FIELD statement into AST.
		 */
		parseField: parseFieldDefinition,

		/**
		 * Parse a DEFINE INDEX statement into AST.
		 */
		parseIndex: parseIndexDefinition,

		/**
		 * Extract table name from a DEFINE TABLE statement.
		 */
		extractTableName,

		// Extracting from runtime models
		/**
		 * Extract SchemaAST from model classes and index definitions.
		 */
		extractSchema: extractSchemaFromDefinables,

		/**
		 * Extract TableAST from a model class.
		 */
		extractTable: extractTableFromModel,

		/**
		 * Extract IndexAST from an index definition.
		 */
		extractIndex: extractIndexFromDefinition,

		/**
		 * Check if a value is a model class.
		 */
		isModelClass,

		/**
		 * Check if a value is an index definition.
		 */
		isIndexDefinition,

		// Comparison
		/**
		 * Compare two schemas and return the differences.
		 */
		compare: compareSchemas,

		/**
		 * Check if two schemas are equal.
		 */
		areEqual: schemasAreEqual,

		/**
		 * Group schema changes by table name.
		 */
		groupByTable: groupChangesByTable,

		/**
		 * Filter changes by type (added, removed, modified).
		 */
		filterByType: filterChangesByType,

		// Generation
		/**
		 * Generate SurrealQL from SchemaAST.
		 */
		generateSurql: generateSurqlFromAST,

		/**
		 * Generate migration SurrealQL from schema changes.
		 */
		generateMigration: generateMigrationSurql,
	},
} as const;

// Re-export types for convenience
export type { ConfigureOptions, SurrealLike, SchemaAST, SchemaChange };

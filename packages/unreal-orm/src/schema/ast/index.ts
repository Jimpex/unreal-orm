/**
 * Schema AST Module
 *
 * Provides bidirectional transformation between SurrealQL and TypeScript:
 * - SurrealQL → AST (parser)
 * - Runtime Models → AST (extractor)
 * - AST ↔ AST comparison (compare)
 * - AST → SurrealQL (generator)
 *
 * @module
 */

// Types
export type {
	SchemaAST,
	TableAST,
	FieldAST,
	IndexAST,
	EventAST,
	PermissionsAST,
	TableType,
} from "./types";

// Parser (SurrealQL → AST)
export {
	parseTableDefinition,
	parseFieldDefinition,
	parseIndexDefinition,
	extractTableName,
} from "./parser";

// Extractor (Runtime Models → AST)
export {
	extractSchemaFromDefinables,
	extractTableFromModel,
	extractIndexFromDefinition,
	isModelClass,
	isIndexDefinition,
} from "./extractor";

// Compare (AST ↔ AST)
export type { ChangeType, SchemaChange } from "./compare";
export {
	compareSchemas,
	schemasAreEqual,
	groupChangesByTable,
	filterChangesByType,
} from "./compare";

// Generator (AST → SurrealQL)
export type { SchemaApplicationMethod } from "./generator";
export { generateSurqlFromAST, generateMigrationSurql } from "./generator";

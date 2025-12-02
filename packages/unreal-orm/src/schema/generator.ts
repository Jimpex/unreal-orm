/**
 * Schema generator functions for Unreal-ORM.
 *
 * This module provides the public API for generating and applying SurrealQL schemas
 * from runtime model classes. It uses the AST system internally for DDL generation.
 *
 * @module
 */
import type { Surreal } from "surrealdb";
import type { Definable } from "../define/types";
import type { AnyModelClass } from "../define/table/types/model";
import {
	extractSchemaFromDefinables,
	extractTableFromModel,
} from "./ast/extractor";
import { generateSurqlFromAST } from "./ast/generator";

// Re-export SchemaApplicationMethod from AST generator for backward compatibility
export type { SchemaApplicationMethod } from "./ast/generator";

/**
 * Generates the full SurrealQL schema for a single table model.
 * This includes the `DEFINE TABLE` statement and all associated `DEFINE FIELD` statements.
 *
 * @internal This is a low-level utility. Prefer `generateFullSchemaQl` for generating the complete schema.
 * @param modelClass The model class to generate the schema for.
 * @param method The method to use for schema application if the table already exists.
 * @returns A string containing the full SurrealQL schema for the table.
 */
export function generateTableSchemaQl(
	modelClass: AnyModelClass,
	method: "IF NOT EXISTS" | "OVERWRITE" | "error" = "error",
): string {
	// Convert model to AST and generate DDL
	const tableAST = extractTableFromModel(modelClass);
	return generateSurqlFromAST({ tables: [tableAST] }, method).trim();
}

/**
 * Generates the full SurrealQL schema for all provided definable entities (tables and indexes).
 *
 * @param definables An array of `Definable` entities (model classes and index definitions).
 * @param method The method to use for schema application if a table already exists.
 * @returns A string containing the complete SurrealQL schema.
 */
export function generateFullSchemaQl(
	definables: Definable[],
	method: "IF NOT EXISTS" | "OVERWRITE" | "error" = "error",
): string {
	// Convert all definables to AST and generate DDL
	const schema = extractSchemaFromDefinables(definables);
	return generateSurqlFromAST(schema, method);
}

/**
 * Generates and applies the full SurrealQL schema to a SurrealDB instance.
 *
 * @param db The SurrealDB instance to apply the schema to.
 * @param definables An array of `Definable` entities (model classes and index definitions).
 * @param method The method to use for schema application if a table already exists.
 */
export async function applySchema(
	db: Surreal,
	definables: Definable[],
	method: "IF NOT EXISTS" | "OVERWRITE" | "error" = "error",
): Promise<void> {
	const schemaQl = generateFullSchemaQl(definables, method);
	if (schemaQl.trim() !== "") {
		await db.query(schemaQl);
	}
}

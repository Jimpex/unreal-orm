// Core ORM Functionality
export * from "./define";
export { Field } from "./fields";
export { Table } from "./define";
// export { BaseTable } from './baseTable';
export { applySchema, generateFullSchemaQl } from "./schemaGenerator";

// Core ORM Types for usage
export type {
	// Field Definition
	FieldDefinition,
	FieldOptions,
	// Table Definition
	TableDefineOptions,
	TablePermissionsOptions,
	IndexDefinition,
	ChangefeedConfig,
	// Querying
	SelectQueryOptions,
	CountQueryOptions,
	OrderByClause,
	// Model Types
	ModelStatic,
	ModelInstance,
	AnyModelClass,
	// Type Inference Helpers
	InferTableDataFromFields,
	InferShapeFromFields,
	InferFieldType,
	CreateData,
	UpdateData,
} from "./types";

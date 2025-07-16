// Public API for unreal-orm

// Main methods and classes
export { default as Table } from "./define/table";
export { Field } from "./schema/field-definitions/builders";
export { applySchema, generateFullSchemaQl } from "./schema/generator";
export { Index } from "./define/index";

// Type definitions
export type {
	FieldDefinition,
	FieldOptions,
} from "./schema/field-definitions/definitions";
export type { IndexDefinition } from "./define/index/types";
export type {
	OrderByClause,
	SelectQueryOptions,
	CountQueryOptions,
} from "./define/table/types/query";
export type {
	ModelStatic,
	ModelInstance,
	InferShapeFromFields,
} from "./define/table/types/model";

import type { RecordId } from "surrealdb";
import type {
	PermissionsClause,
	TablePermissionsOptions,
	FieldPermissionsOptions,
} from "../options";
import type { FieldDefinition, FieldOptions } from "./definitions";
import type {
	AnyModelClass,
	InferFieldType,
	InferShapeFromFields,
} from "../../define/table/types/model";

export interface ArrayFieldOptions<T> extends FieldOptions {
	max?: number;
}

export interface ObjectFieldOptions extends FieldOptions {
	flexible?: boolean;
}

export interface CustomFieldOptions extends ObjectFieldOptions {}

export interface RecordFieldOptions extends FieldOptions {
	reference?: boolean;
	onDelete?: "cascade" | "set null" | "none";
}

export const Field = {
	string(options: FieldOptions = {}): FieldDefinition<string> {
		return { ...options, type: "string" };
	},
	number(options: FieldOptions = {}): FieldDefinition<number> {
		return { ...options, type: "number" };
	},
	bool(options: FieldOptions = {}): FieldDefinition<boolean> {
		return { ...options, type: "bool" };
	},
	datetime(options: FieldOptions = {}): FieldDefinition<Date> {
		return { ...options, type: "datetime" };
	},
	custom<T>(
		typeString: string,
		options: CustomFieldOptions = {},
	): FieldDefinition<T> {
		return { ...options, type: typeString, flexible: options.flexible };
	},
	option<FD extends FieldDefinition<unknown>>(
		fieldDefinition: FD,
	): FieldDefinition<InferFieldType<FD> | undefined> {
		return {
			...fieldDefinition,
			get type() {
				return `option<${fieldDefinition.type}>`;
			},
			isOptional: true,
		};
	},
	array<TElementDef extends FieldDefinition<unknown>>(
		element: TElementDef,
		options: ArrayFieldOptions<InferFieldType<TElementDef>> = {},
	): FieldDefinition<Array<InferFieldType<TElementDef>>> {
		return {
			...options,
			get type() {
				return options.max
					? `array<${element.type}, ${options.max}>`
					: `array<${element.type}>`;
			},
			arrayElementType: element,
		};
	},
	object<TSchema extends Record<string, FieldDefinition<unknown>>>(
		schema: TSchema,
		options: ObjectFieldOptions = {},
	): FieldDefinition<InferShapeFromFields<TSchema>> {
		return {
			...options,
			type: "object",
			objectSchema: schema,
			flexible: options.flexible,
		};
	},
	record<TModel extends AnyModelClass>(
		tableClassThunk: () => TModel,
		options: RecordFieldOptions = {},
	): FieldDefinition<InstanceType<TModel> | RecordId<TModel["_tableName"]>> {
		return {
			...options,
			get type() {
				const tableClass = tableClassThunk();
				return `record<${tableClass._tableName}>`;
			},
			recordTableThunk: tableClassThunk,
		};
	},
};

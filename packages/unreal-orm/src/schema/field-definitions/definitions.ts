import type {
	ModelStatic,
	TableDefineOptions,
} from "../../define/table/types/model";

export interface FieldPermissionsOptions {
	select?: string;
	create?: string;
	update?: string;
	delete?: string;
}

export interface FieldOptions {
	assert?: string;
	default?: string;
	value?: string;
	readonly?: boolean;
	permissions?: string | FieldPermissionsOptions;
	comment?: string;
}

export interface FieldDefinition<T = unknown> extends FieldOptions {
	flexible?: boolean;
	type: string;
	isOptional?: boolean;
	arrayElementType?: FieldDefinition<unknown>;
	objectSchema?: Record<string, FieldDefinition<unknown>>;
	recordTableThunk?: () => ModelStatic<
		// biome-ignore lint/suspicious/noExplicitAny: Using `any` in the thunk is a temporary workaround to break the circular dependency between models.
		any,
		Record<string, FieldDefinition<unknown>>,
		TableDefineOptions<Record<string, FieldDefinition<unknown>>>
	>;
	recordReference?: boolean;
	recordOnDelete?: "cascade" | "set null" | "none";
}

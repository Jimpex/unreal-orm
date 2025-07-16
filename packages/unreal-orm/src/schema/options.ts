// User-facing schema option types for Unreal-ORM

import type { FieldDefinition } from "./field-definitions/definitions.ts";

export interface PermissionsClause {
	select?: string;
	create?: string;
	update?: string;
	delete?: string;
}

export type FieldPermissionsOptions = PermissionsClause;
export type TablePermissionsOptions = PermissionsClause;

export interface ChangefeedConfig {
	duration: string;
	includeOriginal?: boolean;
}

export interface NormalTableOptions<
	TFields extends Record<string, FieldDefinition<unknown>>,
> {
	name: string;
	fields: TFields;
	schemafull?: boolean;
	permissions?: TablePermissionsOptions;
	changefeed?: ChangefeedConfig;
	comment?: string;
}

export type RelationTableFields<
	TIn extends FieldDefinition<unknown>,
	TOut extends FieldDefinition<unknown>,
	TOther extends Record<string, FieldDefinition<unknown>> = Record<
		string,
		never
	>,
> = TOther & { in: TIn; out: TOut };

export interface RelationTableOptions<
	TIn extends FieldDefinition<unknown>,
	TOut extends FieldDefinition<unknown>,
	TOther extends Record<string, FieldDefinition<unknown>> = Record<
		string,
		never
	>,
> extends Omit<
		NormalTableOptions<RelationTableFields<TIn, TOut, TOther>>,
		"fields"
	> {
	fields: RelationTableFields<TIn, TOut, TOther>;
}

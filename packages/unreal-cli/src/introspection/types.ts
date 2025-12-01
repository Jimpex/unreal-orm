/**
 * Internal AST for SurrealDB Schema Introspection
 */

export interface SchemaAST {
	tables: TableAST[];
}

export type TableType = "NORMAL" | "RELATION" | "VIEW";

export interface TableAST {
	name: string;
	type: TableType;
	drop: boolean;
	schemafull: boolean;
	viewQuery?: string; // For VIEWs
	permissions: PermissionsAST;
	fields: FieldAST[];
	indexes: IndexAST[];
	events: EventAST[];
}

export interface FieldAST {
	name: string;
	type: string; // Raw SurrealQL type string (e.g. "string", "record<user>")
	flex: boolean; // "FLEXIBLE"
	default?: string;
	value?: string;
	assert?: string;
	permissions: PermissionsAST;
}

export interface IndexAST {
	name: string;
	columns: string[];
	unique: boolean;
	search?: boolean; // For full-text search indexes
	vector?: boolean; // For vector indexes
}

export interface EventAST {
	name: string;
	cond: string;
	then: string;
}

export interface PermissionsAST {
	select?: string;
	create?: string;
	update?: string;
	delete?: string;
}

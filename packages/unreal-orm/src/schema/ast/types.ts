/**
 * Internal AST for SurrealDB Schema representation.
 * This provides a canonical intermediate representation for bidirectional
 * transformation between SurrealQL and TypeScript.
 *
 * Flow: SurrealQL ↔ SchemaAST ↔ TypeScript/Runtime Models
 *
 * @module
 */

/**
 * Root AST node representing a complete database schema.
 */
export interface SchemaAST {
	tables: TableAST[];
}

/**
 * Table type classification.
 */
export type TableType = "NORMAL" | "RELATION" | "VIEW";

/**
 * AST node representing a table definition.
 */
export interface TableAST {
	/** Table name */
	name: string;
	/** Table type: NORMAL, RELATION, or VIEW */
	type: TableType;
	/** Whether DROP is enabled */
	drop: boolean;
	/** Whether the table is SCHEMAFULL (true), SCHEMALESS (false), or unspecified (undefined) */
	schemafull?: boolean;
	/** View query (for VIEW tables only) */
	viewQuery?: string;
	/** Table-level permissions */
	permissions: PermissionsAST;
	/** Field definitions */
	fields: FieldAST[];
	/** Index definitions */
	indexes: IndexAST[];
	/** Event definitions */
	events: EventAST[];
}

/**
 * AST node representing a field definition.
 */
export interface FieldAST {
	/** Field name (supports dot notation for nested fields, e.g., "address.city") */
	name: string;
	/** Raw SurrealQL type string (e.g., "string", "record<user>", "option<datetime>") */
	type: string;
	/** Whether field is FLEXIBLE */
	flex: boolean;
	/** DEFAULT value expression */
	default?: string;
	/** VALUE expression (computed field) */
	value?: string;
	/** ASSERT expression */
	assert?: string;
	/** Whether field is READONLY */
	readonly?: boolean;
	/** Whether field is a REFERENCE */
	reference?: boolean;
	/** ON DELETE behavior for references: IGNORE, UNSET, CASCADE, REJECT */
	onDelete?: "IGNORE" | "UNSET" | "CASCADE" | "REJECT";
	/** Field comment */
	comment?: string;
	/** Field-level permissions */
	permissions: PermissionsAST;
}

/**
 * AST node representing an index definition.
 */
export interface IndexAST {
	/** Index name */
	name: string;
	/** Columns/fields included in the index */
	columns: string[];
	/** Whether the index enforces uniqueness */
	unique: boolean;
	/** Whether this is a full-text search index */
	search?: boolean;
	/** Search analyzer name */
	analyzer?: string;
	/** Whether this is a vector index */
	vector?: boolean;
	/** Index comment */
	comment?: string;
}

/**
 * AST node representing an event definition.
 */
export interface EventAST {
	/** Event name */
	name: string;
	/** WHEN condition */
	cond: string;
	/** THEN action */
	then: string;
}

/**
 * Permissions object for tables and fields.
 */
export interface PermissionsAST {
	/** SELECT permission expression */
	select?: string;
	/** CREATE permission expression */
	create?: string;
	/** UPDATE permission expression */
	update?: string;
	/** DELETE permission expression */
	delete?: string;
}

import type { RecordId } from "surrealdb";

export interface OrderByClause {
	field: string;
	order?: "ASC" | "DESC" | "asc" | "desc";
	collate?: boolean; // For string collation
	numeric?: boolean; // For numeric collation of strings
}

export interface SelectQueryOptions<TTable> {
	from?: string | RecordId<string>;
	select?: (keyof TTable | string)[];
	where?: string;
	orderBy?: OrderByClause[];
	limit?: number;
	start?: number;
	fetch?: string[];
	groupBy?: (keyof TTable | string)[];
	parallel?: boolean;
	timeout?: string | number;
	with?: string[];
	explain?: boolean;
	only?: boolean;
	vars?: Record<string, unknown>;
}

export interface CountQueryOptions<TTable> {
	where?: string;
	groupBy?: (keyof TTable | string)[];
	parallel?: boolean;
	timeout?: string | number;
}

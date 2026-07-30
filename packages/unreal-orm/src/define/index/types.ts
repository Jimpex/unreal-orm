import type { AnyModelClass } from "../table/types/model";

/**
 * Vector index algorithm type.
 */
export type VectorType = "MTREE" | "HNSW" | "DISKANN";

/**
 * Supported distance metrics for vector indexes.
 */
export type VectorDistance =
	| "EUCLIDEAN"
	| "COSINE"
	| "MANHATTAN"
	| "INNER_PRODUCT"
	| "COSINE_NORMALIZED"
	| "HAMMING";

/**
 * Supported vector element types.
 */
export type VectorElementType =
	| "F64"
	| "F32"
	| "F16"
	| "I64"
	| "I32"
	| "I16"
	| "I8"
	| "U8";

/**
 * Options for a vector index definition.
 * The `type` field discriminates the algorithm and its specific parameters.
 */
export type VectorIndexOptions =
	| {
			type: "MTREE";
			/** Vector dimension (number of elements). */
			dimension: number;
			/** Vector element type. Defaults to F64. */
			elementType?: VectorElementType;
			/** Distance metric. Defaults to EUCLIDEAN. */
			distance?: VectorDistance;
	  }
	| {
			type: "HNSW";
			/** Vector dimension (number of elements). */
			dimension: number;
			/** Vector element type. Defaults to F64. */
			elementType?: VectorElementType;
			/** Distance metric. Defaults to EUCLIDEAN. */
			distance?: VectorDistance;
			/** EF construction. Defaults to 150. */
			efc?: number;
			/** Max connections per element. Defaults to 12. */
			m?: number;
			/** Max connections in the lowest layer. Defaults to 24. */
			m0?: number;
			/** Multiplier for level generation. Computed automatically by default. */
			lm?: number;
	  }
	| {
			type: "DISKANN";
			/** Vector dimension (number of elements). */
			dimension: number;
			/** Vector element type. Defaults to F32. */
			elementType?: VectorElementType;
			/** Distance metric. Defaults to EUCLIDEAN. */
			distance?: VectorDistance;
			/** Target maximum graph degree. Defaults to 64. */
			degree?: number;
			/** Construction search-list size. Defaults to 100. */
			lBuild?: number;
			/** DiskANN pruning parameter. Defaults to 1.2. */
			alpha?: number;
			/** Enable hash-stabilised vector–document keys. */
			hashedVector?: boolean;
	  };

/**
 * Defines the structure of a database index.
 * @internal
 * @example
 * ```ts
 * const userEmailIndex: IndexDefinition = {
 *   _type: 'index',
 *   name: 'user_email_idx',
 *   table: User,
 *   fields: ['email'],
 *   unique: true
 * };
 * ```
 */
export interface IndexDefinition {
	/** @internal A type identifier for the index definition. */
	_type: "index";
	/** The name of the index. */
	name: string;
	/** The model class the index belongs to. */
	table: AnyModelClass;
	/** The fields to be included in the index. Not required for COUNT indexes. */
	fields?: string[];
	/** If true, creates a unique index. */
	unique?: boolean;
	/** If true, creates a COUNT index that maintains a running total for fast `count()` queries. */
	count?: boolean;
	/** If true, creates the index concurrently without blocking other operations. */
	concurrently?: boolean;
	/** If true, defers index updates to a background queue for high-throughput ingestion. Cannot be used with unique indexes. */
	defer?: boolean;
	/** If true, creates a full-text search index. */
	search?: boolean;
	/** The search analyzer to use for a full-text search index. */
	analyzer?: string;
	/** Whether to enable BM25 ranking for full-text search. */
	bm25?: boolean;
	/** Whether to enable keyword highlighting for full-text search. */
	highlights?: boolean;
	/** Vector index options. When set, creates a vector index instead of a regular index. */
	vector?: VectorIndexOptions;
	/** A comment describing the index. */
	comment?: string;
}

/**
 * Defines the options for creating an index definition.
 * This is a subset of `IndexDefinition`, excluding internal properties that are handled by the ORM.
 * @example
 * ```ts
 * const nameIndex: IndexDefineOptions = {
 *   name: 'user_name_idx',
 *   fields: ['name']
 * };
 * ```
 */
export type IndexDefineOptions = Omit<IndexDefinition, "table" | "_type">;

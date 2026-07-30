/**
 * Tests for vector index support across the schema AST pipeline:
 * - Parser: SurrealQL DDL → IndexAST
 * - Generator: IndexAST → SurrealQL DDL
 * - Extractor: IndexDefinition → IndexAST
 * - Compare: detect vector index changes between schemas
 */

import { describe, expect, test } from "bun:test";
import {
	compareSchemas,
	extractIndexFromDefinition,
	extractSchemaFromDefinables,
	Field,
	generateFullSchemaQl,
	Index,
	parseIndexDefinition,
	Table,
} from "../../src";

// ============================================================================
// Test Models
// ============================================================================

class Document extends Table.normal({
	name: "document",
	fields: {
		embedding: Field.array(Field.number()),
		title: Field.string(),
	},
	schemafull: true,
}) {}

// ============================================================================
// Parser Tests
// ============================================================================

describe("parseIndexDefinition — vector indexes", () => {
	test("parses MTREE index with dimension", () => {
		const ql =
			"DEFINE INDEX idx_mtree ON TABLE document FIELDS embedding MTREE DIMENSION 768";
		const result = parseIndexDefinition(ql);
		expect(result.name).toBe("idx_mtree");
		expect(result.columns).toEqual(["embedding"]);
		expect(result.vectorType).toBe("MTREE");
		expect(result.vectorDimension).toBe(768);
	});

	test("parses MTREE index with TYPE and DIST", () => {
		const ql =
			"DEFINE INDEX idx_mtree_full ON TABLE document FIELDS embedding MTREE DIMENSION 768 DIST COSINE TYPE F32";
		const result = parseIndexDefinition(ql);
		expect(result.vectorType).toBe("MTREE");
		expect(result.vectorDimension).toBe(768);
		expect(result.vectorDistance).toBe("COSINE");
		expect(result.vectorElementType).toBe("F32");
	});

	test("parses HNSW index with dimension", () => {
		const ql =
			"DEFINE INDEX idx_hnsw ON TABLE document FIELDS embedding HNSW DIMENSION 4";
		const result = parseIndexDefinition(ql);
		expect(result.name).toBe("idx_hnsw");
		expect(result.vectorType).toBe("HNSW");
		expect(result.vectorDimension).toBe(4);
	});

	test("parses HNSW index with all parameters", () => {
		const ql =
			"DEFINE INDEX idx_hnsw_full ON TABLE document FIELDS embedding HNSW DIMENSION 4 DIST EUCLIDEAN TYPE F64 EFC 150 M 12 M0 24";
		const result = parseIndexDefinition(ql);
		expect(result.vectorType).toBe("HNSW");
		expect(result.vectorDimension).toBe(4);
		expect(result.vectorDistance).toBe("EUCLIDEAN");
		expect(result.vectorElementType).toBe("F64");
		expect(result.vectorEfc).toBe(150);
		expect(result.vectorM).toBe(12);
		expect(result.vectorM0).toBe(24);
	});

	test("parses HNSW index with LM parameter", () => {
		const ql =
			"DEFINE INDEX idx_hnsw_lm ON TABLE document FIELDS embedding HNSW DIMENSION 4 LM 0.40242960438184466f";
		const result = parseIndexDefinition(ql);
		expect(result.vectorLm).toBe(0.40242960438184466);
	});

	test("parses DISKANN index with dimension", () => {
		const ql =
			"DEFINE INDEX idx_diskann ON TABLE document FIELDS embedding DISKANN DIMENSION 4";
		const result = parseIndexDefinition(ql);
		expect(result.name).toBe("idx_diskann");
		expect(result.vectorType).toBe("DISKANN");
		expect(result.vectorDimension).toBe(4);
	});

	test("parses DISKANN index with all parameters", () => {
		const ql =
			"DEFINE INDEX idx_diskann_full ON TABLE document FIELDS embedding DISKANN DIMENSION 4 DIST EUCLIDEAN TYPE F32 DEGREE 64 L_BUILD 100 ALPHA 1.2 HASHED_VECTOR";
		const result = parseIndexDefinition(ql);
		expect(result.vectorType).toBe("DISKANN");
		expect(result.vectorDimension).toBe(4);
		expect(result.vectorDistance).toBe("EUCLIDEAN");
		expect(result.vectorElementType).toBe("F32");
		expect(result.vectorDegree).toBe(64);
		expect(result.vectorLBuild).toBe(100);
		expect(result.vectorAlpha).toBe(1.2);
		expect(result.vectorHashedVector).toBe(true);
	});

	test("parses DISKANN index without HASHED_VECTOR", () => {
		const ql =
			"DEFINE INDEX idx_diskann_nohash ON TABLE document FIELDS embedding DISKANN DIMENSION 4 DEGREE 32";
		const result = parseIndexDefinition(ql);
		expect(result.vectorDegree).toBe(32);
		expect(result.vectorHashedVector).toBeUndefined();
	});

	test("non-vector index has no vector fields", () => {
		const ql = "DEFINE INDEX idx_plain ON TABLE user FIELDS email UNIQUE";
		const result = parseIndexDefinition(ql);
		expect(result.vectorType).toBeUndefined();
		expect(result.vectorDimension).toBeUndefined();
	});
});

// ============================================================================
// Generator Tests (via generateFullSchemaQl)
// ============================================================================

describe("generateFullSchemaQl — vector indexes", () => {
	test("generates MTREE index DDL", () => {
		const idx = Index.define(() => Document, {
			name: "idx_mtree_gen",
			fields: ["embedding"],
			vector: {
				type: "MTREE",
				dimension: 768,
				distance: "COSINE",
				elementType: "F32",
			},
		});

		const ddl = generateFullSchemaQl([Document, idx]);
		expect(ddl).toContain(
			"DEFINE INDEX idx_mtree_gen ON TABLE document FIELDS embedding MTREE DIMENSION 768 TYPE F32 DIST COSINE",
		);
	});

	test("generates HNSW index DDL with all params", () => {
		const idx = Index.define(() => Document, {
			name: "idx_hnsw_gen",
			fields: ["embedding"],
			vector: {
				type: "HNSW",
				dimension: 4,
				distance: "EUCLIDEAN",
				elementType: "F64",
				efc: 200,
				m: 16,
				m0: 32,
			},
		});

		const ddl = generateFullSchemaQl([Document, idx]);
		expect(ddl).toContain(
			"DEFINE INDEX idx_hnsw_gen ON TABLE document FIELDS embedding HNSW DIMENSION 4 TYPE F64 DIST EUCLIDEAN EFC 200 M 16 M0 32",
		);
	});

	test("generates DISKANN index DDL with all params", () => {
		const idx = Index.define(() => Document, {
			name: "idx_diskann_gen",
			fields: ["embedding"],
			vector: {
				type: "DISKANN",
				dimension: 4,
				distance: "EUCLIDEAN",
				elementType: "F32",
				degree: 64,
				lBuild: 100,
				alpha: 1.2,
				hashedVector: true,
			},
		});

		const ddl = generateFullSchemaQl([Document, idx]);
		expect(ddl).toContain(
			"DEFINE INDEX idx_diskann_gen ON TABLE document FIELDS embedding DISKANN DIMENSION 4 TYPE F32 DIST EUCLIDEAN DEGREE 64 L_BUILD 100 ALPHA 1.2 HASHED_VECTOR",
		);
	});

	test("generates HNSW index DDL with minimal params (dimension only)", () => {
		const idx = Index.define(() => Document, {
			name: "idx_hnsw_min",
			fields: ["embedding"],
			vector: {
				type: "HNSW",
				dimension: 128,
			},
		});

		const ddl = generateFullSchemaQl([Document, idx]);
		expect(ddl).toContain(
			"DEFINE INDEX idx_hnsw_min ON TABLE document FIELDS embedding HNSW DIMENSION 128",
		);
		// Extract just the index line to verify no extra params
		const indexLine = ddl.split("\n").find((l) => l.includes("idx_hnsw_min"));
		expect(indexLine).toBeDefined();
		expect(indexLine).not.toContain("EFC");
		expect(indexLine).not.toContain(" M ");
		expect(indexLine).not.toContain("M0");
		expect(indexLine).not.toContain("DIST");
	});
});

// ============================================================================
// Extractor Tests
// ============================================================================

describe("extractIndexFromDefinition — vector indexes", () => {
	test("extracts MTREE vector options", () => {
		const idx = Index.define(() => Document, {
			name: "idx_mtree_ext",
			fields: ["embedding"],
			vector: {
				type: "MTREE",
				dimension: 256,
				distance: "MANHATTAN",
				elementType: "I64",
			},
		});

		const { index, tableName } = extractIndexFromDefinition(idx);
		expect(tableName).toBe("document");
		expect(index.vectorType).toBe("MTREE");
		expect(index.vectorDimension).toBe(256);
		expect(index.vectorDistance).toBe("MANHATTAN");
		expect(index.vectorElementType).toBe("I64");
	});

	test("extracts HNSW vector options", () => {
		const idx = Index.define(() => Document, {
			name: "idx_hnsw_ext",
			fields: ["embedding"],
			vector: {
				type: "HNSW",
				dimension: 512,
				efc: 200,
				m: 16,
				m0: 32,
				lm: 0.5,
			},
		});

		const { index } = extractIndexFromDefinition(idx);
		expect(index.vectorType).toBe("HNSW");
		expect(index.vectorDimension).toBe(512);
		expect(index.vectorEfc).toBe(200);
		expect(index.vectorM).toBe(16);
		expect(index.vectorM0).toBe(32);
		expect(index.vectorLm).toBe(0.5);
	});

	test("extracts DISKANN vector options", () => {
		const idx = Index.define(() => Document, {
			name: "idx_diskann_ext",
			fields: ["embedding"],
			vector: {
				type: "DISKANN",
				dimension: 1024,
				degree: 64,
				lBuild: 100,
				alpha: 1.2,
				hashedVector: true,
			},
		});

		const { index } = extractIndexFromDefinition(idx);
		expect(index.vectorType).toBe("DISKANN");
		expect(index.vectorDimension).toBe(1024);
		expect(index.vectorDegree).toBe(64);
		expect(index.vectorLBuild).toBe(100);
		expect(index.vectorAlpha).toBe(1.2);
		expect(index.vectorHashedVector).toBe(true);
	});

	test("non-vector index has no vector fields in AST", () => {
		const idx = Index.define(() => Document, {
			name: "idx_plain_ext",
			fields: ["title"],
		});

		const { index } = extractIndexFromDefinition(idx);
		expect(index.vectorType).toBeUndefined();
		expect(index.vectorDimension).toBeUndefined();
	});
});

// ============================================================================
// Compare Tests
// ============================================================================

describe("compareSchemas — vector index changes", () => {
	test("detects new vector index", () => {
		const idx = Index.define(() => Document, {
			name: "idx_vector_new",
			fields: ["embedding"],
			vector: {
				type: "HNSW",
				dimension: 128,
			},
		});

		const local = extractSchemaFromDefinables([Document, idx]);
		const remote = extractSchemaFromDefinables([Document]);

		const changes = compareSchemas(local, remote, true);
		expect(
			changes.some(
				(c) => c.type === "index_added" && c.index === "idx_vector_new",
			),
		).toBe(true);
	});

	test("detects vector dimension change", () => {
		const idxOld = Index.define(() => Document, {
			name: "idx_dim_change",
			fields: ["embedding"],
			vector: { type: "HNSW", dimension: 128 },
		});
		const idxNew = Index.define(() => Document, {
			name: "idx_dim_change",
			fields: ["embedding"],
			vector: { type: "HNSW", dimension: 256 },
		});

		const local = extractSchemaFromDefinables([Document, idxNew]);
		const remote = extractSchemaFromDefinables([Document, idxOld]);

		const changes = compareSchemas(local, remote, true);
		expect(
			changes.some(
				(c) => c.type === "index_modified" && c.index === "idx_dim_change",
			),
		).toBe(true);
	});

	test("detects vector type change (MTREE → HNSW)", () => {
		const idxOld = Index.define(() => Document, {
			name: "idx_type_change",
			fields: ["embedding"],
			vector: { type: "MTREE", dimension: 128 },
		});
		const idxNew = Index.define(() => Document, {
			name: "idx_type_change",
			fields: ["embedding"],
			vector: { type: "HNSW", dimension: 128 },
		});

		const local = extractSchemaFromDefinables([Document, idxNew]);
		const remote = extractSchemaFromDefinables([Document, idxOld]);

		const changes = compareSchemas(local, remote, true);
		expect(
			changes.some(
				(c) => c.type === "index_modified" && c.index === "idx_type_change",
			),
		).toBe(true);
	});

	test("detects HNSW parameter change (EFC)", () => {
		const idxOld = Index.define(() => Document, {
			name: "idx_efc_change",
			fields: ["embedding"],
			vector: { type: "HNSW", dimension: 128, efc: 150 },
		});
		const idxNew = Index.define(() => Document, {
			name: "idx_efc_change",
			fields: ["embedding"],
			vector: { type: "HNSW", dimension: 128, efc: 300 },
		});

		const local = extractSchemaFromDefinables([Document, idxNew]);
		const remote = extractSchemaFromDefinables([Document, idxOld]);

		const changes = compareSchemas(local, remote, true);
		expect(
			changes.some(
				(c) => c.type === "index_modified" && c.index === "idx_efc_change",
			),
		).toBe(true);
	});

	test("detects DISKANN HASHED_VECTOR toggle", () => {
		const idxOld = Index.define(() => Document, {
			name: "idx_hash_change",
			fields: ["embedding"],
			vector: { type: "DISKANN", dimension: 128, hashedVector: false },
		});
		const idxNew = Index.define(() => Document, {
			name: "idx_hash_change",
			fields: ["embedding"],
			vector: { type: "DISKANN", dimension: 128, hashedVector: true },
		});

		const local = extractSchemaFromDefinables([Document, idxNew]);
		const remote = extractSchemaFromDefinables([Document, idxOld]);

		const changes = compareSchemas(local, remote, true);
		expect(
			changes.some(
				(c) => c.type === "index_modified" && c.index === "idx_hash_change",
			),
		).toBe(true);
	});

	test("no change when vector params are identical", () => {
		const idx = Index.define(() => Document, {
			name: "idx_unchanged",
			fields: ["embedding"],
			vector: { type: "HNSW", dimension: 128, efc: 200, m: 16 },
		});

		const local = extractSchemaFromDefinables([Document, idx]);
		const remote = extractSchemaFromDefinables([Document, idx]);

		const changes = compareSchemas(local, remote, true);
		expect(
			changes.some(
				(c) => c.type === "index_modified" && c.index === "idx_unchanged",
			),
		).toBe(false);
	});

	test("detects removed vector index", () => {
		const idx = Index.define(() => Document, {
			name: "idx_vector_removed",
			fields: ["embedding"],
			vector: { type: "HNSW", dimension: 128 },
		});

		const local = extractSchemaFromDefinables([Document]);
		const remote = extractSchemaFromDefinables([Document, idx]);

		const changes = compareSchemas(local, remote, true);
		expect(
			changes.some(
				(c) => c.type === "index_removed" && c.index === "idx_vector_removed",
			),
		).toBe(true);
	});
});

// ============================================================================
// Round-trip Tests (Parser → Generator)
// ============================================================================

describe("vector index round-trip (parse → generate)", () => {
	test("MTREE round-trip", () => {
		const original =
			"DEFINE INDEX idx_rt_mtree ON TABLE document FIELDS embedding MTREE DIMENSION 768 DIST COSINE TYPE F32";
		const ast = parseIndexDefinition(original);
		expect(ast.vectorType).toBe("MTREE");
		expect(ast.vectorDimension).toBe(768);
		expect(ast.vectorDistance).toBe("COSINE");
		expect(ast.vectorElementType).toBe("F32");

		// Re-generate from the parsed AST and verify key clauses are present
		const idx = Index.define(() => Document, {
			name: ast.name,
			fields: ast.columns,
			vector: {
				type: "MTREE",
				dimension: ast.vectorDimension ?? 0,
				distance: ast.vectorDistance as "COSINE" | undefined,
				elementType: ast.vectorElementType as "F32" | undefined,
			},
		});
		const ddl = generateFullSchemaQl([Document, idx]);
		expect(ddl).toContain("MTREE DIMENSION 768");
		expect(ddl).toContain("DIST COSINE");
		expect(ddl).toContain("TYPE F32");
	});

	test("HNSW round-trip", () => {
		const original =
			"DEFINE INDEX idx_rt_hnsw ON TABLE document FIELDS embedding HNSW DIMENSION 4 DIST EUCLIDEAN TYPE F64 EFC 200 M 16 M0 32";
		const ast = parseIndexDefinition(original);
		expect(ast.vectorType).toBe("HNSW");
		expect(ast.vectorDimension).toBe(4);
		expect(ast.vectorEfc).toBe(200);
		expect(ast.vectorM).toBe(16);
		expect(ast.vectorM0).toBe(32);
	});

	test("DISKANN round-trip", () => {
		const original =
			"DEFINE INDEX idx_rt_diskann ON TABLE document FIELDS embedding DISKANN DIMENSION 4 DIST EUCLIDEAN TYPE F32 DEGREE 64 L_BUILD 100 ALPHA 1.2 HASHED_VECTOR";
		const ast = parseIndexDefinition(original);
		expect(ast.vectorType).toBe("DISKANN");
		expect(ast.vectorDimension).toBe(4);
		expect(ast.vectorDegree).toBe(64);
		expect(ast.vectorLBuild).toBe(100);
		expect(ast.vectorAlpha).toBe(1.2);
		expect(ast.vectorHashedVector).toBe(true);
	});
});

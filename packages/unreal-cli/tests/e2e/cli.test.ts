/**
 * End-to-End CLI Tests
 *
 * These tests run the actual CLI commands and verify their behavior.
 * Each CLI invocation creates its own in-memory DB, so tests verify
 * command output and generated files rather than shared DB state.
 *
 * Note: Tests that require importing TypeScript schema files use the examples directory
 * which has proper package resolution.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { $ } from "bun";
import { mkdtemp, readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Path to the CLI entry point
const CLI_PATH = join(import.meta.dir, "../../src/index.ts");
// Path to examples directory (has proper package resolution)
const EXAMPLES_DIR = join(import.meta.dir, "../../examples/simple");

describe("CLI E2E Tests", () => {
	let testDir: string;

	beforeEach(async () => {
		// Create fresh temp directory for each test
		testDir = await mkdtemp(join(tmpdir(), "unreal-cli-test-"));

		// Create minimal config
		await writeFile(
			join(testDir, "unreal.config.json"),
			JSON.stringify({ path: "./unreal" }),
		);

		// Create tables directory
		await mkdir(join(testDir, "unreal", "tables"), { recursive: true });
	});

	describe("pull command", () => {
		test("should handle empty database gracefully", async () => {
			// Each CLI invocation creates its own in-memory DB (empty)
			const result =
				await $`bun run ${CLI_PATH} pull --embedded memory -n test -d test -s ${join(testDir, "unreal/tables")} -y`
					.cwd(testDir)
					.nothrow();

			// Should complete without error
			expect(result.exitCode).toBe(0);
			// With empty DB, should show "up to date" message
			expect(result.stdout.toString()).toContain("up to date");
		});

		test("should show proper output messages", async () => {
			const result =
				await $`bun run ${CLI_PATH} pull --embedded memory -n test -d test -s ${join(testDir, "unreal/tables")} -y`
					.cwd(testDir)
					.nothrow();

			const output = result.stdout.toString();
			expect(output).toContain("UnrealORM Pull");
			// Note: Spinner output is cleared, so we check for final messages
			expect(output).toContain("up to date");
		});
	});

	describe("push command", () => {
		test("should apply TypeScript schema to database using examples", async () => {
			// Use the examples directory which has proper package resolution
			const result =
				await $`bun run ${CLI_PATH} push --embedded memory -n test -d test -s ${EXAMPLES_DIR} -y`
					.cwd(join(import.meta.dir, "../.."))
					.nothrow();

			expect(result.exitCode).toBe(0);
			// Verify output mentions applying changes
			const output = result.stdout.toString();
			expect(output).toContain("APPLYING ALL CHANGES");
			expect(output).toContain("Schema push complete");
		});

		test("should fail gracefully when schema directory doesn't exist", async () => {
			const result =
				await $`bun run ${CLI_PATH} push --embedded memory -n test -d test -s ${join(testDir, "nonexistent")} -y`
					.cwd(testDir)
					.nothrow();

			expect(result.exitCode).not.toBe(0);
			expect(result.stdout.toString()).toContain("not found");
		});
	});

	describe("diff command", () => {
		test("should work with examples directory", async () => {
			// Run diff command using examples
			const result =
				await $`bun run ${CLI_PATH} diff --embedded memory -n test -d test -s ${EXAMPLES_DIR}`
					.cwd(join(import.meta.dir, "../.."))
					.nothrow();

			// Should complete (may show differences since DB is empty)
			expect(result.exitCode).toBe(0);
		});
	});

	describe("mermaid command", () => {
		test("should generate mermaid diagram from code using examples", async () => {
			const outputPath = join(testDir, "schema.mermaid");

			// Run mermaid command using examples directory
			const result =
				await $`bun run ${CLI_PATH} mermaid --code -s ${EXAMPLES_DIR} -o ${outputPath}`
					.cwd(join(import.meta.dir, "../.."))
					.nothrow();

			expect(result.exitCode).toBe(0);

			// Verify output file
			const mermaidContent = await readFile(outputPath, "utf-8");
			expect(mermaidContent).toContain("erDiagram");
			expect(mermaidContent).toContain("user");
		});

		test("should generate mermaid diagram from database (empty)", async () => {
			// Note: Each CLI invocation creates its own in-memory DB
			// So we test that it handles an empty DB gracefully
			const outputPath = join(testDir, "db-schema.mermaid");

			const result =
				await $`bun run ${CLI_PATH} mermaid --db --embedded memory -n test -d test -o ${outputPath}`
					.cwd(testDir)
					.nothrow();

			expect(result.exitCode).toBe(0);

			const mermaidContent = await readFile(outputPath, "utf-8");
			expect(mermaidContent).toContain("erDiagram");
		});

		test("should output to stdout with --stdout flag", async () => {
			// Test stdout output with empty DB
			const result =
				await $`bun run ${CLI_PATH} mermaid --db --embedded memory -n test -d test --stdout`
					.cwd(testDir)
					.nothrow();

			expect(result.exitCode).toBe(0);
			expect(result.stdout.toString()).toContain("erDiagram");
		});

		test("should generate from .surql file", async () => {
			// Create a .surql file
			const surqlContent = `
DEFINE TABLE category SCHEMAFULL;
DEFINE FIELD name ON TABLE category TYPE string;
DEFINE FIELD slug ON TABLE category TYPE string;
`;
			const surqlPath = join(testDir, "schema.surql");
			await writeFile(surqlPath, surqlContent);

			const outputPath = join(testDir, "from-surql.mermaid");

			const result =
				await $`bun run ${CLI_PATH} mermaid --surql ${surqlPath} -o ${outputPath}`
					.cwd(testDir)
					.nothrow();

			expect(result.exitCode).toBe(0);

			const mermaidContent = await readFile(outputPath, "utf-8");
			expect(mermaidContent).toContain("erDiagram");
			expect(mermaidContent).toContain("category");
		});
	});

	describe("CLI flags", () => {
		test("should accept all connection flags", async () => {
			// Test that CLI accepts all connection flags without error
			// This will fail to connect but should parse flags correctly
			const result =
				await $`bun run ${CLI_PATH} pull --url ws://localhost:8000 -u root -p root -n test -d test --auth-level root -s ${join(testDir, "unreal/tables")} -y`
					.cwd(testDir)
					.nothrow();

			// Should not have flag parsing errors
			expect(result.stderr.toString()).not.toContain("unknown option");
		});

		test("should show help with --help flag", async () => {
			const result = await $`bun run ${CLI_PATH} --help`.cwd(testDir).nothrow();

			expect(result.exitCode).toBe(0);
			expect(result.stdout.toString()).toContain("UnrealORM CLI");
			expect(result.stdout.toString()).toContain("pull");
			expect(result.stdout.toString()).toContain("push");
			expect(result.stdout.toString()).toContain("diff");
			expect(result.stdout.toString()).toContain("mermaid");
		});

		test("should show command help with command --help", async () => {
			const result = await $`bun run ${CLI_PATH} pull --help`
				.cwd(testDir)
				.nothrow();

			expect(result.exitCode).toBe(0);
			expect(result.stdout.toString()).toContain("--schema-dir");
			expect(result.stdout.toString()).toContain("--url");
			expect(result.stdout.toString()).toContain("--auth-level");
		});

		test("should show version with --version flag", async () => {
			const result = await $`bun run ${CLI_PATH} --version`
				.cwd(testDir)
				.nothrow();

			expect(result.exitCode).toBe(0);
			// Version should be a semver-like string
			expect(result.stdout.toString()).toMatch(/\d+\.\d+\.\d+/);
		});
	});
});

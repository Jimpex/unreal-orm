import chalk from "chalk";
import type {
	ChangeType as OrmChangeType,
	SchemaChange as OrmSchemaChange,
} from "unreal-orm";

// Re-export ORM types and compareSchemas for convenience
export type { OrmChangeType as ChangeType, OrmSchemaChange as SchemaChange };
export { compareSchemas } from "unreal-orm";

type ChangeType = OrmChangeType;
type SchemaChange = OrmSchemaChange;

/**
 * Formats schema changes for display.
 */
export function formatChanges(
	changes: SchemaChange[],
	detailed = false,
): string {
	if (changes.length === 0) {
		return chalk.green("✓ Schemas are identical");
	}

	const lines: string[] = [];
	const byTable = new Map<string, SchemaChange[]>();

	// Group by table (bucket changes use table: "")
	for (const change of changes) {
		const groupKey =
			change.table || (change.type.startsWith("bucket_") ? "Buckets" : "");
		const existing = byTable.get(groupKey) || [];
		existing.push(change);
		byTable.set(groupKey, existing);
	}

	// Format by table
	for (const [table, tableChanges] of byTable) {
		lines.push(chalk.bold(`\n${table || "Other"}:`));
		for (const change of tableChanges) {
			const icon = getChangeIcon(change.type);
			let colorizedDesc = change.description;

			// Colorize description based on change type
			if (change.type.includes("added")) {
				colorizedDesc = chalk.green(change.description);
			} else if (change.type.includes("removed")) {
				colorizedDesc = chalk.red(change.description);
			} else {
				colorizedDesc = chalk.yellow(change.description);
			}

			lines.push(`  ${icon} ${colorizedDesc}`);

			// Show detailed info if requested
			if (
				detailed &&
				(change.oldValue !== undefined || change.newValue !== undefined)
			) {
				if (change.oldValue !== undefined) {
					lines.push(
						chalk.dim("      Old: ") + chalk.red(formatValue(change.oldValue)),
					);
				}
				if (change.newValue !== undefined) {
					lines.push(
						chalk.dim("      New: ") +
							chalk.green(formatValue(change.newValue)),
					);
				}
			}
		}
	}

	return lines.join("\n");
}

function getChangeIcon(type: ChangeType): string {
	if (type.includes("added")) return chalk.green("+");
	if (type.includes("removed")) return chalk.red("-");
	return chalk.yellow("~");
}

function formatValue(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.join(", ")}]`;
	}
	if (typeof value === "object" && value !== null) {
		// Handle BoundQuery objects from surql templates
		if ("query" in value && typeof value.query === "string") {
			return value.query;
		}
		// Handle other objects
		const str = JSON.stringify(value);
		// If it's a simple object, show it inline
		if (str.length < 50) {
			return str;
		}
		return JSON.stringify(value, null, 2);
	}
	return String(value);
}

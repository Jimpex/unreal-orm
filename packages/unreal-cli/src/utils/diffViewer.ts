import chalk from "chalk";
import { diffLines, type Change } from "diff";

const CONTEXT_LINES = 3; // Number of unchanged lines to show around changes

/**
 * Generates a git-style unified diff between two file contents
 * Shows only context around changes for better readability
 */
export function getFileDiff(
	filename: string,
	oldContent: string | undefined,
	newContent: string,
): string {
	const lines: string[] = [];

	if (!oldContent) {
		// New file - show first few lines
		lines.push(chalk.bold.green(`\n+++ ${filename} (new file)`));
		lines.push(chalk.dim("─".repeat(60)));
		const contentLines = newContent.split("\n").slice(0, 20);
		for (const line of contentLines) {
			lines.push(chalk.green(`+ ${line}`));
		}
		if (newContent.split("\n").length > 20) {
			lines.push(
				chalk.dim(`... ${newContent.split("\n").length - 20} more lines`),
			);
		}
		lines.push(chalk.dim("─".repeat(60)));
		return lines.join("\n");
	}

	// Show unified diff with context
	lines.push(chalk.bold(`\n--- ${filename}`));
	lines.push(chalk.bold(`+++ ${filename}`));
	lines.push(chalk.dim("─".repeat(60)));

	const changes = diffLines(oldContent, newContent);

	// Build hunks (groups of changes with context)
	const hunks = buildHunks(changes);

	if (hunks.length === 0) {
		lines.push(chalk.dim("  (no changes)"));
	}

	for (const hunk of hunks) {
		// Show hunk header
		lines.push(
			chalk.cyan(
				`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
			),
		);

		// Show hunk content
		for (const line of hunk.lines) {
			if (line.type === "added") {
				lines.push(chalk.green(`+ ${line.content}`));
			} else if (line.type === "removed") {
				lines.push(chalk.red(`- ${line.content}`));
			} else {
				lines.push(chalk.dim(`  ${line.content}`));
			}
		}

		lines.push(""); // Blank line between hunks
	}

	lines.push(chalk.dim("─".repeat(60)));
	return lines.join("\n");
}

// Deprecated: use getFileDiff instead
export function displayFileDiff(
	filename: string,
	oldContent: string | undefined,
	newContent: string,
): void {
	console.log(getFileDiff(filename, oldContent, newContent));
}

interface HunkLine {
	type: "added" | "removed" | "context";
	content: string;
}

interface Hunk {
	oldStart: number;
	oldLines: number;
	newStart: number;
	newLines: number;
	lines: HunkLine[];
}

/**
 * Builds hunks from diff changes, grouping nearby changes with context
 */
function buildHunks(changes: Change[]): Hunk[] {
	// Implementation redirected to refactored version for simpler flow
	return buildHunksRefactored(changes);
}

/**
 * Refactored hunk builder with proper merging logic
 */
function buildHunksRefactored(changes: Change[]): Hunk[] {
	const hunks: Hunk[] = [];
	let currentHunk: Hunk | null = null;
	// let oldLine = 1;
	// let newLine = 1;

	// Flatten changes into a single line array for easier processing
	const allLines: {
		type: "added" | "removed" | "context";
		content: string;
		oldLine?: number;
		newLine?: number;
	}[] = [];

	let tempOld = 1;
	let tempNew = 1;

	for (const change of changes) {
		if (!change) continue;

		const lines = change.value.split("\n");
		if (lines[lines.length - 1] === "") lines.pop();

		for (const line of lines) {
			const type = change.added
				? "added"
				: change.removed
					? "removed"
					: "context";
			allLines.push({
				type,
				content: line,
				oldLine: type !== "added" ? tempOld : undefined,
				newLine: type !== "removed" ? tempNew : undefined,
			});

			if (type !== "added") tempOld++;
			if (type !== "removed") tempNew++;
		}
	}

	for (let i = 0; i < allLines.length; i++) {
		const line = allLines[i];
		if (!line) continue; // TypeScript safety

		if (line.type === "added" || line.type === "removed") {
			// Found a change
			if (!currentHunk) {
				// Start new hunk
				// Look back for context
				const contextStart = Math.max(0, i - CONTEXT_LINES);
				const contextLines = allLines.slice(contextStart, i);

				// Handle potentially undefined values with defaults
				const firstCtx = contextLines[0];
				const startOld = firstCtx?.oldLine ?? line.oldLine ?? 1;
				const startNew = firstCtx?.newLine ?? line.newLine ?? 1;

				currentHunk = {
					oldStart: startOld,
					newStart: startNew,
					oldLines: 0,
					newLines: 0,
					lines: [],
				};

				// Add context
				for (const ctx of contextLines) {
					if (ctx) {
						currentHunk.lines.push({ type: "context", content: ctx.content });
						currentHunk.oldLines++;
						currentHunk.newLines++;
					}
				}
			}

			// Add change
			currentHunk.lines.push({ type: line.type, content: line.content });
			if (line.type !== "added") currentHunk.oldLines++;
			if (line.type !== "removed") currentHunk.newLines++;
		} else {
			// Context line
			if (currentHunk) {
				// We have an open hunk. Should we close it?
				// Look ahead to see if there's another change coming soon
				let nextChangeIndex = -1;
				for (let j = i + 1; j < allLines.length; j++) {
					const nextLine = allLines[j];
					if (nextLine && nextLine.type !== "context") {
						nextChangeIndex = j;
						break;
					}
				}

				if (nextChangeIndex !== -1) {
					const distance = nextChangeIndex - i;
					if (distance <= CONTEXT_LINES * 2) {
						// Change is close, keep hunk open
						currentHunk.lines.push({ type: "context", content: line.content });
						currentHunk.oldLines++;
						currentHunk.newLines++;
						continue; // Continue to next line
					}
				}

				// Find index of last change in this hunk
				const distanceToLastChange = currentHunk.lines
					.slice()
					.reverse()
					.findIndex((l) => l.type !== "context");

				if (distanceToLastChange < CONTEXT_LINES) {
					currentHunk.lines.push({ type: "context", content: line.content });
					currentHunk.oldLines++;
					currentHunk.newLines++;
				} else {
					// We have enough trailing context. Close hunk.
					hunks.push(currentHunk);
					currentHunk = null;
				}
			}
		}
	}

	if (currentHunk) {
		hunks.push(currentHunk);
	}

	return hunks;
}

/**
 * Shows a summary of what changed in a file
 */
export function getChangeSummary(
	oldContent: string | undefined,
	newContent: string,
): string {
	if (!oldContent) {
		const lines = newContent.split("\n").length;
		return `New file (${lines} lines)`;
	}

	const changes = diffLines(oldContent, newContent);
	let added = 0;
	let removed = 0;

	for (const change of changes) {
		const lineCount = change.value.split("\n").length - 1;
		if (change.added) {
			added += lineCount;
		} else if (change.removed) {
			removed += lineCount;
		}
	}

	if (added === 0 && removed === 0) {
		return "No changes";
	}

	const parts: string[] = [];
	if (added > 0) parts.push(chalk.green(`+${added}`));
	if (removed > 0) parts.push(chalk.red(`-${removed}`));

	return parts.join(" ");
}

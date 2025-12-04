import chalk from "chalk";
import { theme, box } from "./theme";
import { clearScreen, readKey, readLine, wasCancelled } from "./terminal";

/**
 * Render the header (no leading newline to prevent clipping)
 */
export function renderHeader(title: string, subtitle?: string): void {
	const width = Math.min(process.stdout.columns || 80, 80);
	console.log(theme.primary.bold(`  ${title}`));
	if (subtitle) {
		console.log(theme.dim(`  ${subtitle}`));
	}
	console.log(theme.dim(box.horizontal.repeat(width)));
}

/**
 * Render a boxed table
 */
export function renderTable(
	headers: string[],
	rows: string[][],
	colWidths: number[],
): void {
	// Top border
	console.log(
		theme.dim(
			`${box.topLeft}${colWidths.map((w) => box.horizontal.repeat(w)).join(box.teeDown)}${box.topRight}`,
		),
	);

	// Header row
	const headerRow = headers
		.map((h, i) => padCell(h, colWidths[i] ?? 10))
		.join(theme.dim(box.vertical));
	console.log(
		`${theme.dim(box.vertical)}${chalk.bold(headerRow)}${theme.dim(box.vertical)}`,
	);

	// Header separator
	console.log(
		theme.dim(
			`${box.teeRight}${colWidths.map((w) => box.horizontal.repeat(w)).join(box.cross)}${box.teeLeft}`,
		),
	);

	// Data rows
	for (const row of rows) {
		const rowStr = row
			.map((cell, i) => padCell(cell, colWidths[i] ?? 10))
			.join(theme.dim(box.vertical));
		console.log(
			`${theme.dim(box.vertical)}${rowStr}${theme.dim(box.vertical)}`,
		);
	}

	// Bottom border
	console.log(
		theme.dim(
			`${box.bottomLeft}${colWidths.map((w) => box.horizontal.repeat(w)).join(box.teeUp)}${box.bottomRight}`,
		),
	);
}

/**
 * Render table with row selection indicator
 */
export function renderTableWithSelection(
	headers: string[],
	rows: string[][],
	colWidths: number[],
	selectedIdx: number,
): void {
	// Top border
	console.log(
		theme.dim(
			`  ${box.topLeft}${colWidths.map((w) => box.horizontal.repeat(w)).join(box.teeDown)}${box.topRight}`,
		),
	);

	// Header row
	const headerRow = headers
		.map((h, i) => padCell(h, colWidths[i] ?? 10))
		.join(theme.dim(box.vertical));
	console.log(
		`${theme.dim(`  ${box.vertical}`)}${chalk.bold(headerRow)}${theme.dim(box.vertical)}`,
	);

	// Header separator
	console.log(
		theme.dim(
			`  ${box.teeRight}${colWidths.map((w) => box.horizontal.repeat(w)).join(box.cross)}${box.teeLeft}`,
		),
	);

	// Data rows
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		if (!row) continue;
		const isSelected = i === selectedIdx;
		const prefix = isSelected ? theme.primary("▸ ") : "  ";
		const rowStr = row
			.map((cell, j) => padCell(cell, colWidths[j] ?? 10))
			.join(theme.dim(box.vertical));
		console.log(
			`${prefix}${theme.dim(box.vertical)}${rowStr}${theme.dim(box.vertical)}`,
		);
	}

	// Bottom border
	console.log(
		theme.dim(
			`  ${box.bottomLeft}${colWidths.map((w) => box.horizontal.repeat(w)).join(box.teeUp)}${box.bottomRight}`,
		),
	);
}

/**
 * Pad a cell to a specific width, handling ANSI codes correctly
 */
export function padCell(text: string, width: number): string {
	const stripped = stripAnsi(text);
	if (stripped.length >= width) {
		// Truncate based on visible characters, preserving ANSI codes
		const truncated = truncateWithAnsi(text, width - 1);
		return `${truncated}…`;
	}
	return text + " ".repeat(width - stripped.length);
}

/**
 * Truncate a string with ANSI codes to a visible length
 */
function truncateWithAnsi(text: string, maxVisible: number): string {
	let visible = 0;
	let i = 0;
	// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequence detection
	const ansiRegex = /\x1b\[[0-9;]*m/g;

	while (i < text.length && visible < maxVisible) {
		// Check if we're at the start of an ANSI sequence
		ansiRegex.lastIndex = i;
		const match = ansiRegex.exec(text);

		if (match && match.index === i) {
			// Skip the ANSI sequence entirely
			i = ansiRegex.lastIndex;
		} else {
			// Regular character
			visible++;
			i++;
		}
	}

	// Include any trailing ANSI reset codes
	const result = text.slice(0, i);
	// Add reset code if we truncated mid-color
	if (text.includes("\x1b[") && !result.endsWith("\x1b[0m")) {
		return `${result}\x1b[0m`;
	}
	return result;
}

/**
 * Strip ANSI codes for length calculation
 */
export function stripAnsi(str: string): string {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequence detection
	return str.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Simple yes/no confirmation
 */
export async function confirmYesNo(prompt: string): Promise<boolean> {
	clearScreen();
	renderHeader("Confirm", "");

	console.log("");
	console.log(theme.warning(`  ${prompt}`));
	console.log("");
	console.log(theme.dim("  y yes • n no"));

	const key = await readKey();
	return key === "y" || key === "Y";
}

/**
 * Confirm a destructive action by typing a confirmation string
 */
export async function confirmAction(
	prompt: string,
	expected: string,
): Promise<boolean> {
	clearScreen();
	renderHeader("Confirm Action", "");

	console.log("");
	console.log(theme.warning(`  ${prompt}`));
	console.log("");

	const input = await readLine("  > ");
	return input === expected;
}

/**
 * Show an error message and wait for keypress
 */
export async function showError(message: string): Promise<void> {
	clearScreen();
	renderHeader("Error", "");

	console.log("");
	console.log(theme.error(`  ${message}`));
	console.log("");
	console.log(theme.dim("  Press any key to continue..."));

	await readKey();
}

/**
 * Show a success message and wait for keypress
 */
export async function showSuccess(message: string): Promise<void> {
	clearScreen();
	renderHeader("Success", "");

	console.log("");
	console.log(theme.success(`  ${message}`));
	console.log("");
	console.log(theme.dim("  Press any key to continue..."));

	await readKey();
}

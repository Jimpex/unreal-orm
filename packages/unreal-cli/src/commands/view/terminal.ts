// ANSI escape codes for proper screen control
const CURSOR_HOME = "\x1b[H"; // Move cursor to top-left
const CLEAR_TO_END = "\x1b[J"; // Clear from cursor to end of screen
const DISABLE_LINE_WRAP = "\x1b[?7l"; // Prevent line wrapping
const ENABLE_LINE_WRAP = "\x1b[?7h"; // Re-enable line wrapping
export const HIDE_CURSOR = "\x1b[?25l";
export const SHOW_CURSOR = "\x1b[?25h";

// Alternate screen buffer - like vim/less, doesn't pollute scrollback
const ENTER_ALT_SCREEN = "\x1b[?1049h";
const EXIT_ALT_SCREEN = "\x1b[?1049l";

/**
 * Enter alternate screen buffer (call once at TUI start)
 */
export function enterAltScreen(): void {
	process.stdout.write(
		ENTER_ALT_SCREEN + DISABLE_LINE_WRAP + CURSOR_HOME + CLEAR_TO_END,
	);
}

/**
 * Exit alternate screen buffer (call once at TUI end)
 */
export function exitAltScreen(): void {
	process.stdout.write(ENABLE_LINE_WRAP + EXIT_ALT_SCREEN);
}

/**
 * Clear screen - clears visible area and moves cursor home
 * Also resets scroll region to full screen
 */
export function clearScreen(): void {
	const rows = process.stdout.rows || 24;
	// Reset scroll region to full screen, then clear
	process.stdout.write(`\x1b[1;${rows}r${CURSOR_HOME}${CLEAR_TO_END}`);
}

/**
 * Soft refresh - same as clearScreen (both are efficient in alt buffer)
 */
export function softRefresh(): void {
	const rows = process.stdout.rows || 24;
	process.stdout.write(`\x1b[1;${rows}r${CURSOR_HOME}${CLEAR_TO_END}`);
}

/**
 * Read a single keypress
 */
export async function readKey(): Promise<string> {
	return new Promise((resolve) => {
		const stdin = process.stdin;
		const wasRaw = stdin.isRaw;

		stdin.setRawMode(true);
		stdin.resume();
		stdin.setEncoding("utf8");

		const onData = (key: string) => {
			stdin.setRawMode(wasRaw);
			stdin.pause();
			stdin.removeListener("data", onData);

			// Handle special keys
			if (key === "\u0003") {
				// Ctrl+C - restore cursor before exit
				process.stdout.write(SHOW_CURSOR);
				process.exit(0);
			}
			resolve(key);
		};

		stdin.once("data", onData);
	});
}

/** Special marker for cancelled input */
const CANCEL_MARKER = "\x1bCANCEL";

/**
 * Read a line of text input with optional default value
 */
export async function readLine(
	prompt: string,
	defaultValue = "",
): Promise<string> {
	process.stdout.write(SHOW_CURSOR);
	process.stdout.write(prompt);

	// Pre-fill with default value
	let buffer = defaultValue;
	if (defaultValue) {
		process.stdout.write(defaultValue);
	}

	return new Promise((resolve) => {
		const stdin = process.stdin;

		stdin.setRawMode(true);
		stdin.resume();
		stdin.setEncoding("utf8");

		const onData = (key: string) => {
			if (key === "\u0003") {
				// Ctrl+C
				process.stdout.write(SHOW_CURSOR);
				process.exit(0);
			}
			if (key === "\r" || key === "\n") {
				// Enter
				stdin.setRawMode(false);
				stdin.pause();
				stdin.removeListener("data", onData);
				process.stdout.write("\n");
				process.stdout.write(HIDE_CURSOR);
				resolve(buffer);
			} else if (key === "\u001b") {
				// Escape - cancel (return empty to signal cancellation)
				stdin.setRawMode(false);
				stdin.pause();
				stdin.removeListener("data", onData);
				process.stdout.write("\n");
				process.stdout.write(HIDE_CURSOR);
				resolve(CANCEL_MARKER);
			} else if (key === "\u007f" || key === "\b") {
				// Backspace
				if (buffer.length > 0) {
					buffer = buffer.slice(0, -1);
					process.stdout.write("\b \b");
				}
			} else if (key >= " " && key <= "~") {
				// Printable character
				buffer += key;
				process.stdout.write(key);
			}
		};

		stdin.on("data", onData);
	});
}

/** Check if readLine was cancelled */
export function wasCancelled(input: string): boolean {
	return input === CANCEL_MARKER;
}

/**
 * Multi-line text editor with cursor movement and scrolling
 * Returns the edited text, or CANCEL_MARKER if cancelled
 */
export async function editText(
	initialValue: string,
	header: { title: string; subtitle: string },
): Promise<string> {
	// Split into lines for editing
	const lines = initialValue.split("\n");
	let cursorLine = 0;
	let cursorCol = 0;
	let scrollOffset = 0;
	let lastScrollOffset = -1; // Track if we need full redraw

	const termHeight = process.stdout.rows || 24;
	const termWidth = process.stdout.columns || 80;
	const maxVisibleLines = termHeight - 6; // header(3) + footer(2) + status(1)
	const headerLines = 3; // Number of header lines before content

	// Move cursor to specific row (1-indexed)
	const moveTo = (row: number, col: number) => {
		process.stdout.write(`\x1b[${row};${col}H`);
	};

	// Clear current line and write new content
	const writeLine = (row: number, content: string) => {
		moveTo(row, 1);
		process.stdout.write(`\x1b[2K${content}`);
	};

	// Full render (only on scroll or initial)
	const renderFull = () => {
		softRefresh();

		// Header
		console.log(`  \x1b[1m${header.title}\x1b[0m`);
		console.log(`  \x1b[90m${header.subtitle}\x1b[0m`);
		console.log(`\x1b[90m${"─".repeat(Math.min(termWidth, 80))}\x1b[0m`);

		// Render visible lines
		const endLine = Math.min(scrollOffset + maxVisibleLines, lines.length);
		for (let i = scrollOffset; i < endLine; i++) {
			renderLineContent(i);
		}

		// Pad remaining lines
		for (let i = endLine - scrollOffset; i < maxVisibleLines; i++) {
			console.log("\x1b[90m  ~\x1b[0m");
		}

		renderStatusLine();
		lastScrollOffset = scrollOffset;
	};

	// Render a single line's content
	const renderLineContent = (lineIdx: number) => {
		const line = lines[lineIdx] ?? "";
		const lineNum = String(lineIdx + 1).padStart(3, " ");
		const isCursorLine = lineIdx === cursorLine;

		let displayLine = line;
		if (displayLine.length > termWidth - 8) {
			displayLine = `${displayLine.slice(0, termWidth - 11)}...`;
		}

		if (isCursorLine) {
			const before = displayLine.slice(0, cursorCol);
			const cursor = displayLine[cursorCol] ?? " ";
			const after = displayLine.slice(cursorCol + 1);
			console.log(
				`\x1b[90m${lineNum}\x1b[0m \x1b[36m${before}\x1b[7m${cursor}\x1b[0m${after}`,
			);
		} else {
			console.log(`\x1b[90m${lineNum}\x1b[0m ${displayLine}`);
		}
	};

	// Update just the current line and status (fast path)
	const updateCurrentLine = (prevLine?: number) => {
		// If scroll changed, do full redraw
		const oldScroll = scrollOffset;
		if (cursorLine < scrollOffset) {
			scrollOffset = cursorLine;
		} else if (cursorLine >= scrollOffset + maxVisibleLines) {
			scrollOffset = cursorLine - maxVisibleLines + 1;
		}

		if (scrollOffset !== oldScroll || scrollOffset !== lastScrollOffset) {
			renderFull();
			return;
		}

		// Update previous line if cursor moved vertically
		if (
			prevLine !== undefined &&
			prevLine !== cursorLine &&
			prevLine >= scrollOffset &&
			prevLine < scrollOffset + maxVisibleLines
		) {
			const screenRow = headerLines + 1 + (prevLine - scrollOffset);
			const line = lines[prevLine] ?? "";
			const lineNum = String(prevLine + 1).padStart(3, " ");
			let displayLine = line;
			if (displayLine.length > termWidth - 8) {
				displayLine = `${displayLine.slice(0, termWidth - 11)}...`;
			}
			writeLine(screenRow, `\x1b[90m${lineNum}\x1b[0m ${displayLine}`);
		}

		// Update current line
		const screenRow = headerLines + 1 + (cursorLine - scrollOffset);
		const line = lines[cursorLine] ?? "";
		const lineNum = String(cursorLine + 1).padStart(3, " ");
		let displayLine = line;
		if (displayLine.length > termWidth - 8) {
			displayLine = `${displayLine.slice(0, termWidth - 11)}...`;
		}
		const before = displayLine.slice(0, cursorCol);
		const cursor = displayLine[cursorCol] ?? " ";
		const after = displayLine.slice(cursorCol + 1);
		writeLine(
			screenRow,
			`\x1b[90m${lineNum}\x1b[0m \x1b[36m${before}\x1b[7m${cursor}\x1b[0m${after}`,
		);

		renderStatusLine();
	};

	// Render status line
	const renderStatusLine = () => {
		const statusRow = headerLines + maxVisibleLines + 1;
		const endLine = Math.min(scrollOffset + maxVisibleLines, lines.length);
		const pos = `Ln ${cursorLine + 1}, Col ${cursorCol + 1}`;
		const scrollInfo =
			lines.length > maxVisibleLines
				? ` | ${scrollOffset + 1}-${endLine}/${lines.length}`
				: "";
		writeLine(
			statusRow,
			`\x1b[90m  ${pos}${scrollInfo} | Ctrl+S save | Esc cancel\x1b[0m`,
		);
	};

	process.stdout.write(SHOW_CURSOR);
	renderFull();

	return new Promise((resolve) => {
		const stdin = process.stdin;
		stdin.setRawMode(true);
		stdin.resume();
		stdin.setEncoding("utf8");

		const cleanup = (result: string) => {
			stdin.setRawMode(false);
			stdin.pause();
			stdin.removeListener("data", onData);
			process.stdout.write(HIDE_CURSOR);
			resolve(result);
		};

		const onData = (key: string) => {
			const prevLine = cursorLine;
			const currentLine = lines[cursorLine] ?? "";
			let needsFullRedraw = false;

			// Ctrl+C - exit
			if (key === "\u0003") {
				process.stdout.write(SHOW_CURSOR);
				process.exit(0);
			}

			// Ctrl+S - save
			if (key === "\u0013") {
				cleanup(lines.join("\n"));
				return;
			}

			// Escape - cancel
			if (key === "\u001b" && key.length === 1) {
				cleanup(CANCEL_MARKER);
				return;
			}

			// Arrow keys
			if (key === "\u001b[A") {
				// Up
				if (cursorLine > 0) {
					cursorLine--;
					cursorCol = Math.min(cursorCol, (lines[cursorLine] ?? "").length);
				}
			} else if (key === "\u001b[B") {
				// Down
				if (cursorLine < lines.length - 1) {
					cursorLine++;
					cursorCol = Math.min(cursorCol, (lines[cursorLine] ?? "").length);
				}
			} else if (key === "\u001b[C") {
				// Right
				if (cursorCol < currentLine.length) {
					cursorCol++;
				} else if (cursorLine < lines.length - 1) {
					cursorLine++;
					cursorCol = 0;
				}
			} else if (key === "\u001b[D") {
				// Left
				if (cursorCol > 0) {
					cursorCol--;
				} else if (cursorLine > 0) {
					cursorLine--;
					cursorCol = (lines[cursorLine] ?? "").length;
				}
			} else if (key === "\u001b[H" || key === "\u001b[1~") {
				// Home
				cursorCol = 0;
			} else if (key === "\u001b[F" || key === "\u001b[4~") {
				// End
				cursorCol = currentLine.length;
			} else if (key === "\u001b[5~") {
				// Page Up
				cursorLine = Math.max(0, cursorLine - maxVisibleLines);
				cursorCol = Math.min(cursorCol, (lines[cursorLine] ?? "").length);
			} else if (key === "\u001b[6~") {
				// Page Down
				cursorLine = Math.min(lines.length - 1, cursorLine + maxVisibleLines);
				cursorCol = Math.min(cursorCol, (lines[cursorLine] ?? "").length);
			} else if (key === "\r" || key === "\n") {
				// Enter - insert new line (needs full redraw)
				const before = currentLine.slice(0, cursorCol);
				const after = currentLine.slice(cursorCol);
				lines[cursorLine] = before;
				lines.splice(cursorLine + 1, 0, after);
				cursorLine++;
				cursorCol = 0;
				needsFullRedraw = true;
			} else if (key === "\u007f" || key === "\b") {
				// Backspace
				if (cursorCol > 0) {
					lines[cursorLine] =
						currentLine.slice(0, cursorCol - 1) + currentLine.slice(cursorCol);
					cursorCol--;
				} else if (cursorLine > 0) {
					// Join with previous line (needs full redraw)
					const prevLineContent = lines[cursorLine - 1] ?? "";
					cursorCol = prevLineContent.length;
					lines[cursorLine - 1] = prevLineContent + currentLine;
					lines.splice(cursorLine, 1);
					cursorLine--;
					needsFullRedraw = true;
				}
			} else if (key === "\u001b[3~") {
				// Delete
				if (cursorCol < currentLine.length) {
					lines[cursorLine] =
						currentLine.slice(0, cursorCol) + currentLine.slice(cursorCol + 1);
				} else if (cursorLine < lines.length - 1) {
					// Join with next line (needs full redraw)
					lines[cursorLine] = `${currentLine}${lines[cursorLine + 1] ?? ""}`;
					lines.splice(cursorLine + 1, 1);
					needsFullRedraw = true;
				}
			} else if (key === "\t") {
				// Tab - insert spaces
				lines[cursorLine] =
					`${currentLine.slice(0, cursorCol)}  ${currentLine.slice(cursorCol)}`;
				cursorCol += 2;
			} else if (key.length === 1 && key >= " " && key <= "~") {
				// Printable character
				lines[cursorLine] =
					`${currentLine.slice(0, cursorCol)}${key}${currentLine.slice(cursorCol)}`;
				cursorCol++;
			}

			if (needsFullRedraw) {
				renderFull();
			} else {
				updateCurrentLine(prevLine);
			}
		};

		stdin.on("data", onData);
	});
}

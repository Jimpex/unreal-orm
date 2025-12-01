/**
 * A smart printer that tracks how many lines it has output,
 * allowing for "rewinding" (clearing) the output to replace it.
 */
export class SmartPrinter {
	private lineCount = 0;

	/**
	 * Prints a message and tracks the number of lines used.
	 */
	log(message = ""): void {
		console.log(message);
		// Count newlines + 1 (for the line itself)
		// Also need to account for wrapping, but for now simple newline counting is a good approximation
		this.lineCount += message.split("\n").length;
	}

	/**
	 * Clears the lines printed by this printer since the last clear/start.
	 */
	clear(): void {
		if (this.lineCount > 0) {
			// Move cursor up by lineCount
			process.stdout.moveCursor(0, -this.lineCount);
			// Clear everything from cursor down
			process.stdout.clearScreenDown();
			this.lineCount = 0;
		}
	}

	/**
	 * Resets the line counter without clearing (e.g. if we want to keep history)
	 */
	reset(): void {
		this.lineCount = 0;
	}
}

export const printer = new SmartPrinter();

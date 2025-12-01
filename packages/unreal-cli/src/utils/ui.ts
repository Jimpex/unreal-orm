import chalk from "chalk";
import ora, { type Ora } from "ora";
import { printer } from "./printer";

// Symbols
const SYMBOLS = {
	success: "✅",
	error: "❌",
	warning: "⚠️",
	info: "ℹ️",
	step: "🔹",
	arrow: "➜",
	line: "─",
	corner: "└─",
};

// Colors - Consistent theme
const THEME = {
	primary: chalk.hex("#FF00A0"), // Neon Pink/Magenta for Unreal identity
	secondary: chalk.cyan,
	success: chalk.green,
	error: chalk.red,
	warning: chalk.yellow,
	info: chalk.blue,
	dim: chalk.gray,
	code: chalk.hex("#E0E0E0"),
	url: chalk.underline.cyan,
};

/**
 * Centralized UI styling utility for UnrealORM CLI
 */
export const ui = {
	/**
	 * Display a consistent header/banner
	 */
	header(title: string, subtitle?: string): void {
		console.log("");
		console.log(THEME.primary.bold(` ${title} `));
		if (subtitle) {
			console.log(THEME.dim(` ${subtitle}`));
		}
		console.log("");
	},

	/**
	 * Display a section divider
	 */
	divider(): void {
		console.log(THEME.dim(SYMBOLS.line.repeat(60)));
	},

	/**
	 * Display a success message
	 */
	success(message: string): void {
		console.log(THEME.success(`${SYMBOLS.success}  ${message}`));
	},

	/**
	 * Display an error message
	 */
	error(message: string, error?: unknown): void {
		console.log(THEME.error(`${SYMBOLS.error}  ${message}`));
		if (error) {
			if (error instanceof Error) {
				console.log(THEME.dim(`   ${error.stack || error.message}`));
			} else {
				console.log(THEME.dim(`   ${String(error)}`));
			}
		}
	},

	/**
	 * Display a warning message
	 */
	warn(message: string): void {
		console.log(THEME.warning(`${SYMBOLS.warning}  ${message}`));
	},

	/**
	 * Display an info message
	 */
	info(message: string): void {
		console.log(THEME.info(`${SYMBOLS.info}  ${message}`));
	},

	/**
	 * Display a step/process message
	 */
	step(message: string, detail?: string): void {
		console.log(
			THEME.secondary(`${SYMBOLS.step}  ${message}`) +
				(detail ? THEME.dim(` ${detail}`) : ""),
		);
	},

	/**
	 * Start a spinner
	 */
	spin(text: string): Ora {
		return ora({
			text,
			color: "cyan",
			spinner: "dots",
		}).start();
	},

	/**
	 * Format code snippet
	 */
	code(text: string): string {
		return THEME.code(text);
	},

	/**
	 * Format command
	 */
	cmd(text: string): string {
		return THEME.code(`$ ${text}`);
	},

	/**
	 * Format URL/Link
	 */
	link(text: string, url?: string): string {
		return THEME.url(url || text);
	},

	/**
	 * Dim text
	 */
	dim(text: string): string {
		return THEME.dim(text);
	},

	/**
	 * Bold text
	 */
	bold(text: string): string {
		return chalk.bold(text);
	},

	/**
	 * New line
	 */
	newline(): void {
		console.log("");
	},

	/**
	 * Access to the smart printer for rewritable output
	 */
	get printer() {
		return printer;
	},

	/**
	 * Theme constants
	 */
	theme: THEME,
	symbols: SYMBOLS,
};

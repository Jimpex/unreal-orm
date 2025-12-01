/**
 * Reusable prompt utilities for CLI commands.
 * Centralizes common prompt patterns to follow DRY principles.
 */

import prompts from "prompts";
import type {
	ConnectionConfig,
	EmbeddedConnection,
	RemoteConnection,
} from "../config/types";
import { ui } from "./ui";

export interface ConnectionPromptOptions {
	url?: string;
	username?: string;
	password?: string;
	namespace?: string;
	database?: string;
	authLevel?: string;
	embedded?: string;
}

/**
 * Prompts for missing connection details.
 * Only asks for values that aren't already provided.
 */
export async function promptForConnection(
	options: ConnectionPromptOptions,
): Promise<ConnectionConfig> {
	const embedded = options.embedded;

	const responses = await prompts(
		[
			{
				type: !embedded && !options.url ? "text" : null,
				name: "url",
				message: "Database URL:",
				initial: "http://localhost:8000",
			},
			{
				type: !embedded && !options.username ? "text" : null,
				name: "username",
				message: "Username:",
				initial: "root",
			},
			{
				type: !embedded && !options.password ? "password" : null,
				name: "password",
				message: "Password:",
			},
			{
				type: !embedded && !options.authLevel ? "select" : null,
				name: "authLevel",
				message: "Auth level:",
				choices: [
					{ title: "Root", value: "root" },
					{ title: "Namespace", value: "namespace" },
					{ title: "Database", value: "database" },
				],
				initial: 0,
			},
			{
				type: !options.namespace ? "text" : null,
				name: "namespace",
				message: "Namespace:",
			},
			{
				type: !options.database ? "text" : null,
				name: "database",
				message: "Database:",
			},
		],
		{
			onCancel: () => {
				ui.newline();
				ui.warn("Operation cancelled.");
				process.exit(0);
			},
		},
	);

	// Build connection config
	if (embedded) {
		const embeddedMode =
			embedded === "memory"
				? "memory"
				: (`file://${embedded}` as `file://${string}`);
		return {
			embedded: embeddedMode,
			namespace: options.namespace || responses.namespace,
			database: options.database || responses.database,
		} as EmbeddedConnection;
	}

	const finalUrl = options.url || responses.url;
	const finalUsername = options.username || responses.username;
	const finalPassword = options.password || responses.password;
	const finalAuthLevel = options.authLevel || responses.authLevel || "root";
	const finalNamespace = options.namespace || responses.namespace;
	const finalDatabase = options.database || responses.database;

	// Build authentication object based on auth level
	let authentication: Record<string, string>;
	if (finalAuthLevel === "database") {
		authentication = {
			username: finalUsername,
			password: finalPassword,
			namespace: finalNamespace,
			database: finalDatabase,
		};
	} else if (finalAuthLevel === "namespace") {
		authentication = {
			username: finalUsername,
			password: finalPassword,
			namespace: finalNamespace,
		};
	} else {
		// Root auth
		authentication = {
			username: finalUsername,
			password: finalPassword,
		};
	}

	return {
		url: finalUrl,
		namespace: finalNamespace,
		database: finalDatabase,
		authentication,
	} as RemoteConnection;
}

/**
 * Prompts for confirmation.
 * Returns the user's choice. Exits the process if cancelled (Ctrl+C).
 */
export async function confirm(
	message: string,
	initial = true,
): Promise<boolean> {
	const response = await prompts(
		{
			type: "confirm",
			name: "value",
			message,
			initial,
		},
		{
			onCancel: () => {
				console.log("\nOperation cancelled.");
				process.exit(0);
			},
		},
	);
	return response.value;
}

/**
 * Prompts for a single text input.
 * Exits the process if cancelled (Ctrl+C).
 */
export async function promptText(
	message: string,
	initial?: string,
): Promise<string> {
	const response = await prompts(
		{
			type: "text",
			name: "value",
			message,
			initial,
		},
		{
			onCancel: () => {
				ui.newline();
				ui.warn("Operation cancelled.");
				process.exit(0);
			},
		},
	);
	return response.value || "";
}

/**
 * Prompts for selection from a list.
 * Exits the process if cancelled (Ctrl+C).
 */
export async function promptSelect<T extends string>(
	message: string,
	choices: Array<{ title: string; value: T }>,
): Promise<T | undefined> {
	const response = await prompts(
		{
			type: "select",
			name: "value",
			message,
			choices,
		},
		{
			onCancel: () => {
				console.log("\nOperation cancelled.");
				process.exit(0);
			},
		},
	);
	return response.value;
}

/**
 * Prompts for selection from a list with support for disabled options.
 * Disabled options are shown but cannot be selected.
 * Exits the process if cancelled (Ctrl+C).
 */
export async function promptSelectWithDisabled<T extends string>(
	message: string,
	choices: Array<{ title: string; value: T; disabled?: boolean }>,
): Promise<T | undefined> {
	const response = await prompts(
		{
			type: "select",
			name: "value",
			message,
			choices: choices.map((c) => ({
				title: c.title,
				value: c.value,
				disabled: c.disabled,
			})),
		},
		{
			onCancel: () => {
				console.log("\nOperation cancelled.");
				process.exit(0);
			},
		},
	);
	return response.value;
}

/**
 * File review action choices
 */
export type FileReviewAction = "yes" | "no" | "cancel" | "all";

/**
 * Prompts for file-by-file review with git-style keybinds.
 * Returns the user's choice for this specific file.
 */
export async function promptFileReview(
	filename: string,
	index: number,
	total: number,
): Promise<FileReviewAction> {
	const response = await prompts(
		{
			type: "text",
			name: "action",
			message: `[${index}/${total}] Apply this change? (y)es / (n)o / (a)ccept all / (c)ancel`,
			validate: (value: string) => {
				const normalized = value.toLowerCase().trim();
				if (
					["y", "yes", "n", "no", "a", "all", "c", "cancel"].includes(
						normalized,
					)
				) {
					return true;
				}
				return "Please enter: y/yes, n/no, a/all, or c/cancel";
			},
		},
		{
			onCancel: () => {
				ui.newline();
				ui.warn("Operation cancelled.");
				process.exit(0);
			},
		},
	);

	const normalized = response.action.toLowerCase().trim();

	if (normalized === "y" || normalized === "yes") return "yes";
	if (normalized === "n" || normalized === "no") return "no";
	if (normalized === "a" || normalized === "all") return "all";
	if (normalized === "c" || normalized === "cancel") return "cancel";

	// Should never reach here due to validation
	return "no";
}

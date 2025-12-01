/**
 * Helper utilities for parsing SurrealDB DEFINE statements.
 * These functions extract common patterns from DEFINE statements.
 */

/**
 * Safely extracts a regex match group with null checking.
 */
export function extractMatch(
	text: string,
	pattern: RegExp,
	groupIndex = 1,
): string | undefined {
	const match = text.match(pattern);
	return match?.[groupIndex];
}

/**
 * Safely extracts a required regex match group, throwing if not found.
 */
export function extractRequiredMatch(
	text: string,
	pattern: RegExp,
	errorMessage: string,
	groupIndex = 1,
): string {
	const match = text.match(pattern);
	if (!match || !match[groupIndex]) {
		throw new Error(errorMessage);
	}
	return match[groupIndex];
}

/**
 * Extracts permissions clause from a DEFINE statement.
 */
export function extractPermissions(ql: string): Record<string, string> {
	const permissions: Record<string, string> = {};

	// Match PERMISSIONS clauses
	const permMatch = ql.match(/PERMISSIONS\s+(.*?)(?=\s+(?:COMMENT|$))/is);
	if (!permMatch || !permMatch[1]) return permissions;

	const permClause = permMatch[1];

	// Parse individual permission types
	const forSelect = permClause.match(/FOR\s+SELECT\s+(.*?)(?=\s+FOR|$)/i);
	const forCreate = permClause.match(/FOR\s+CREATE\s+(.*?)(?=\s+FOR|$)/i);
	const forUpdate = permClause.match(/FOR\s+UPDATE\s+(.*?)(?=\s+FOR|$)/i);
	const forDelete = permClause.match(/FOR\s+DELETE\s+(.*?)(?=\s+FOR|$)/i);

	if (forSelect?.[1]) permissions.select = forSelect[1].trim();
	if (forCreate?.[1]) permissions.create = forCreate[1].trim();
	if (forUpdate?.[1]) permissions.update = forUpdate[1].trim();
	if (forDelete?.[1]) permissions.delete = forDelete[1].trim();

	// Handle shorthand: PERMISSIONS FULL/NONE
	if (permClause.match(/^\s*(FULL|NONE)\s*$/i)) {
		const value = permClause.trim();
		permissions.select = value;
		permissions.create = value;
		permissions.update = value;
		permissions.delete = value;
	}

	return permissions;
}

/**
 * Checks if a DEFINE statement contains a specific keyword.
 */
export function hasKeyword(ql: string, keyword: string): boolean {
	const pattern = new RegExp(`\\b${keyword}\\b`, "i");
	return pattern.test(ql);
}

/**
 * Extracts a clause value from a DEFINE statement.
 * Stops at the next clause keyword or end of string.
 */
export function extractClause(
	ql: string,
	clauseName: string,
	stopKeywords: string[] = [],
): string | undefined {
	const stopPattern =
		stopKeywords.length > 0
			? `(?=\\s+(?:${stopKeywords.join("|")}|$))`
			: "(?=\\s+(?:COMMENT|$))";

	const pattern = new RegExp(
		`\\s${clauseName}\\s+(.*?)${stopPattern}`,
		"is",
	);
	const match = ql.match(pattern);
	return match?.[1]?.trim();
}

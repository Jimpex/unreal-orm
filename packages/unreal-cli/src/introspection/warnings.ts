/**
 * Warning utilities for unsupported or partially supported SurrealDB features.
 * Helps users understand what features are not yet implemented in the CLI.
 */

import chalk from "chalk";

interface FeatureWarning {
	feature: string;
	reason: string;
	suggestion?: string;
}

const warnings: FeatureWarning[] = [];

/**
 * Adds a warning for an unsupported feature.
 */
export function addWarning(
	feature: string,
	reason: string,
	suggestion?: string,
): void {
	warnings.push({ feature, reason, suggestion });
}

/**
 * Checks if a feature is supported and adds a warning if not.
 */
export function checkFeatureSupport(
	featureType: string,
	featureName: string,
	definition: string,
): boolean {
	// Check for unsupported field types
	if (featureType === "field") {
		// Complex object schemas
		if (definition.includes("TYPE object") && definition.includes("{")) {
			addWarning(
				`Field '${featureName}'`,
				"Object field with inline schema definition",
				"Object fields are parsed as Field.object({}) - you may need to manually define the schema",
			);
			return false;
		}

		// Geometry with specific types
		if (definition.includes("TYPE geometry<")) {
			const match = definition.match(/geometry<(\w+)>/);
			const geoType = match?.[1];
			if (
				geoType &&
				!["point", "linestring", "polygon", "multipoint", "multilinestring", "multipolygon", "collection", "feature"].includes(
					geoType.toLowerCase(),
				)
			) {
				addWarning(
					`Field '${featureName}'`,
					`Uncommon geometry type: ${geoType}`,
					"Verify the generated Field.geometry() call is correct",
				);
			}
		}
	}

	// Check for unsupported index types
	if (featureType === "index") {
		// Vector indexes (HNSW, MTREE)
		if (definition.includes("MTREE") || definition.includes("HNSW")) {
			addWarning(
				`Index '${featureName}'`,
				"Vector index (MTREE/HNSW) detected",
				"Vector indexes are not yet fully supported in code generation",
			);
			return false;
		}

		// Search analyzer indexes
		if (definition.includes("SEARCH ANALYZER")) {
			addWarning(
				`Index '${featureName}'`,
				"Search analyzer index detected",
				"Search indexes are parsed but may need manual configuration",
			);
		}
	}

	// Check for unsupported table features
	if (featureType === "table") {
		// Changefeeds
		if (definition.includes("CHANGEFEED")) {
			addWarning(
				`Table '${featureName}'`,
				"Changefeed configuration detected",
				"Changefeeds are not yet supported in code generation",
			);
		}
	}

	// Check for events
	if (featureType === "event") {
		addWarning(
			`Event '${featureName}'`,
			"Events/triggers are not yet supported",
			"You'll need to manually create event definitions",
		);
		return false;
	}

	// Check for analyzers
	if (featureType === "analyzer") {
		addWarning(
			`Analyzer '${featureName}'`,
			"Analyzers are not yet supported",
			"Analyzer definitions will be skipped",
		);
		return false;
	}

	// Check for functions
	if (featureType === "function") {
		addWarning(
			`Function '${featureName}'`,
			"Custom functions are not yet supported",
			"Function definitions will be skipped",
		);
		return false;
	}

	// Check for params
	if (featureType === "param") {
		addWarning(
			`Parameter '${featureName}'`,
			"Database parameters are not yet supported",
			"Parameter definitions will be skipped",
		);
		return false;
	}

	return true;
}

/**
 * Displays all accumulated warnings.
 */
export function displayWarnings(): void {
	if (warnings.length === 0) return;

	console.log(chalk.yellow("\n⚠️  Warnings:\n"));

	for (const warning of warnings) {
		console.log(chalk.yellow(`  • ${warning.feature}: ${warning.reason}`));
		if (warning.suggestion) {
			console.log(chalk.dim(`    → ${warning.suggestion}`));
		}
	}

	console.log();
}

/**
 * Clears all warnings.
 */
export function clearWarnings(): void {
	warnings.length = 0;
}

/**
 * Gets the count of warnings.
 */
export function getWarningCount(): number {
	return warnings.length;
}

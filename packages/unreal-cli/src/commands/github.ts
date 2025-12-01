import { Command } from "@commander-js/extra-typings";
import { ui } from "../utils/ui";

const GITHUB_URL = "https://github.com/Jimpex/unreal-orm";

/**
 * Open the UnrealORM GitHub repository in the default browser.
 */
export const githubCommand = new Command("github")
	.description("Open the UnrealORM GitHub repository")
	.action(async () => {
		const { exec } = await import("node:child_process");
		const { platform } = await import("node:os");

		const openCommand =
			platform() === "win32"
				? "start"
				: platform() === "darwin"
					? "open"
					: "xdg-open";

		exec(`${openCommand} ${GITHUB_URL}`, (error) => {
			if (error) {
				ui.info(`Visit: ${GITHUB_URL}`);
			}
		});
	});

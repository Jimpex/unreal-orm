import chalk from "chalk";

// Theme colors
export const theme = {
	primary: chalk.hex("#FF00A0"),
	dim: chalk.gray,
	highlight: chalk.cyan,
	success: chalk.green,
	warning: chalk.yellow,
	error: chalk.red,
};

// Box drawing characters
export const box = {
	topLeft: "┌",
	topRight: "┐",
	bottomLeft: "└",
	bottomRight: "┘",
	horizontal: "─",
	vertical: "│",
	teeRight: "├",
	teeLeft: "┤",
	teeDown: "┬",
	teeUp: "┴",
	cross: "┼",
};

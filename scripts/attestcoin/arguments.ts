import { AttestcoinError } from "./errors.js";

export interface ParsedArguments {
  json: boolean;
  help: boolean;
  values: Record<string, string>;
}

export function parseArguments(argv: string[]): ParsedArguments {
  const values: Record<string, string> = {};
  let json = false;
  let help = false;

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--json") {
      json = true;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      help = true;
      continue;
    }
    if (!argument.startsWith("--")) {
      throw invalidArgument(argument);
    }
    const key = argument.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw invalidArgument(argument);
    values[key] = value;
    index++;
  }

  return { json, help, values };
}

function invalidArgument(argument: string): AttestcoinError {
  return new AttestcoinError(
    "Validating arguments",
    "validation_error",
    `Invalid or incomplete argument: ${argument}.`,
    "Run the command with --help to see its required arguments.",
  );
}

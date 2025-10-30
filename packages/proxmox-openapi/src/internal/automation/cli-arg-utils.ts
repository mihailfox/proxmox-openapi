export type BooleanString = "true" | "false" | "1" | "0" | "yes" | "no" | "on" | "off";

export function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  switch (normalized as BooleanString) {
    case "true":
    case "1":
    case "yes":
    case "on":
      return true;
    case "false":
    case "0":
    case "no":
    case "off":
      return false;
    default:
      throw new Error(`Invalid boolean value: ${value}`);
  }
}

export function normalizeBooleanFlagArguments(
  argv: readonly string[],
  flag: string
): { argv: string[]; value?: boolean } {
  const normalized: string[] = [];
  let resolved: boolean | undefined;
  const prefix = `--${flag}`;
  const negated = `--no-${flag}`;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === prefix) {
      const next = argv[index + 1];
      if (next && !next.startsWith("-")) {
        resolved = parseBoolean(next);
        index += 1;
      } else {
        resolved = true;
      }
      continue;
    }

    if (token === negated) {
      resolved = false;
      continue;
    }

    if (token.startsWith(`${prefix}=`)) {
      const raw = token.slice(prefix.length + 1);
      resolved = parseBoolean(raw);
      continue;
    }

    normalized.push(token);
  }

  return { argv: normalized, value: resolved };
}

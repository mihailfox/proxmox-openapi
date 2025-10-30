import { promises as fs } from "node:fs";
import path from "node:path";

interface CliOptions {
  officialRoots: string[];
  irPath: string;
  output?: string;
  limit?: number;
}

interface MethodBlock {
  path?: string;
  method?: string;
  subclass?: string;
  name?: string;
  raw: string;
}

interface ModuleEntry {
  filePath: string;
  blocks: MethodBlock[];
}

interface PackageSection {
  name: string;
  content: string;
}

interface OfficialEndpoint {
  path: string;
  method: string;
  module: string;
  name?: string;
}

interface ScrapedEndpoint {
  path: string;
  method: string;
  groupId: string;
  groupPath: string;
}

interface ComparisonResult {
  officialEndpoints: OfficialEndpoint[];
  scrapedEndpoints: ScrapedEndpoint[];
  shared: OfficialEndpoint[];
  officialOnly: OfficialEndpoint[];
  scrapedOnly: ScrapedEndpoint[];
  officialByMethod: Record<string, number>;
  scrapedByMethod: Record<string, number>;
}

const DEFAULT_OFFICIAL_ROOT = path.resolve("vendor", "pve-manager");
const DEFAULT_IR_PATH = path.resolve("tools", "api-normalizer", "data", "ir", "proxmox-openapi-ir.json");

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    officialRoots: [DEFAULT_OFFICIAL_ROOT],
    irPath: DEFAULT_IR_PATH,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--official" || arg === "--official-root") {
      const value = argv[i + 1];
      if (value) {
        for (const entry of value.split(",")) {
          const trimmed = entry.trim();
          if (trimmed.length === 0) {
            continue;
          }
          options.officialRoots.push(path.resolve(trimmed));
        }
      }
      i += 1;
    } else if (arg === "--ir") {
      options.irPath = path.resolve(argv[i + 1] ?? "");
      i += 1;
    } else if (arg === "--output") {
      options.output = path.resolve(argv[i + 1] ?? "");
      i += 1;
    } else if (arg === "--limit") {
      options.limit = Number.parseInt(argv[i + 1] ?? "", 10);
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      printUsageAndExit();
    }
  }

  return options;
}

function printUsageAndExit(): never {
  const usage =
    `Usage: tsx pvesh-comparison.ts [options]\n\n` +
    `Options:\n` +
    `  --official <path>   Add a search root for Perl modules (repeatable, comma-separated values supported).\n` +
    `                      Defaults to vendor/pve-manager.\n` +
    `  --ir <path>         Path to the normalized IR JSON file (default packages/proxmox-openapi/data/api-normalizer/cache/ir/proxmox-openapi-ir.json).\n` +
    `  --output <path>     Optional JSON output file for the comparison summary.\n` +
    `  --limit <number>    Limit the number of diff entries printed per category.\n` +
    `  -h, --help          Show this message.`;
  console.log(usage);
  process.exit(0);
}

const METHOD_REGEX = /method\s*=>\s*(['"])(GET|POST|PUT|DELETE|OPTIONS|PATCH|HEAD)\1/;
const PATH_REGEX = /path\s*=>\s*(['"])(.*?)\1/;
const SUBCLASS_REGEX = /subclass\s*=>\s*(['"])([\w:]+)\1/;
const NAME_REGEX = /name\s*=>\s*(['"])(.*?)\1/;

async function readFileIfExists(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function extractMethodBlocks(content: string): MethodBlock[] {
  const blocks: MethodBlock[] = [];
  const needle = "register_method";
  let index = content.indexOf(needle);

  while (index !== -1) {
    const braceStart = content.indexOf("{", index);
    if (braceStart === -1) {
      break;
    }

    let depth = 0;
    let blockEnd = -1;
    let inString: string | null = null;

    for (let i = braceStart; i < content.length; i += 1) {
      const char = content[i];
      const prevChar = content[i - 1];

      if (inString) {
        if (char === inString && prevChar !== "\\") {
          inString = null;
        }
        continue;
      }

      if (char === "'" || char === '"') {
        inString = char;
        continue;
      }

      if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          blockEnd = i;
          break;
        }
      }
    }

    if (blockEnd === -1) {
      break;
    }

    const rawBlock = content.slice(braceStart, blockEnd + 1);
    const methodMatch = rawBlock.match(METHOD_REGEX);
    const pathMatch = rawBlock.match(PATH_REGEX);
    const subclassMatch = rawBlock.match(SUBCLASS_REGEX);
    const nameMatch = rawBlock.match(NAME_REGEX);

    blocks.push({
      raw: rawBlock,
      method: methodMatch?.[2],
      path: pathMatch?.[2],
      subclass: subclassMatch?.[2],
      name: nameMatch?.[2],
    });

    index = content.indexOf(needle, blockEnd);
  }

  return blocks;
}

function extractPackageSections(content: string): PackageSection[] {
  const regex = /package\s+([\w:]+)\s*;/g;
  const packages: { name: string; bodyStart: number; statementStart: number }[] = [];
  let execResult = regex.exec(content);

  while (execResult) {
    packages.push({
      name: execResult[1],
      bodyStart: regex.lastIndex,
      statementStart: execResult.index,
    });

    execResult = regex.exec(content);
  }

  const sections: PackageSection[] = [];

  for (let i = 0; i < packages.length; i += 1) {
    const start = packages[i].bodyStart;
    const end = i + 1 < packages.length ? packages[i + 1].statementStart : content.length;
    sections.push({
      name: packages[i].name,
      content: content.slice(start, end),
    });
  }

  return sections;
}

async function walkForPerlModules(base: string, moduleMap: Map<string, ModuleEntry>, visitedFiles: Set<string>) {
  let stats: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stats = await fs.stat(base);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw error;
  }

  if (!stats.isDirectory()) {
    return;
  }

  const stack: string[] = [base];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === ".git" || entry.name === "debian" || entry.name === "t" || entry.name === "tests") {
          continue;
        }
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".pm")) {
        if (visitedFiles.has(fullPath)) {
          continue;
        }
        visitedFiles.add(fullPath);
        const content = await readFileIfExists(fullPath);
        if (!content) {
          continue;
        }
        const sections = extractPackageSections(content);
        for (const section of sections) {
          if (!(section.name === "PVE::API2" || section.name.startsWith("PVE::API2::"))) {
            continue;
          }
          const blocks = extractMethodBlocks(section.content);
          moduleMap.set(section.name, { filePath: fullPath, blocks });
        }
      }
    }
  }
}

async function buildModuleIndex(officialRoots: string[]): Promise<Map<string, ModuleEntry>> {
  const moduleMap = new Map<string, ModuleEntry>();
  const visitedFiles = new Set<string>();

  for (const root of officialRoots) {
    await walkForPerlModules(root, moduleMap, visitedFiles);
    await walkForPerlModules(path.join(root, "src"), moduleMap, visitedFiles);
  }

  return moduleMap;
}

function joinSegments(prefix: string[], segment: string | undefined): string[] {
  if (!segment || segment.trim() === "") {
    return prefix;
  }

  const parts = segment.split("/").filter((part) => part.length > 0);
  return [...prefix, ...parts];
}

function collectOfficialEndpoints(
  moduleMap: Map<string, ModuleEntry>,
  moduleName: string,
  prefix: string[] = [],
  missingModules: Set<string> = new Set(),
  callStack: string[] = []
): { endpoints: OfficialEndpoint[]; missing: Set<string> } {
  if (callStack.includes(moduleName)) {
    return { endpoints: [], missing: missingModules };
  }

  const entry = moduleMap.get(moduleName);
  if (!entry) {
    missingModules.add(moduleName);
    return { endpoints: [], missing: missingModules };
  }

  const endpoints: OfficialEndpoint[] = [];

  for (const block of entry.blocks) {
    const nextSegments = joinSegments(prefix, block.path);

    if (block.subclass) {
      const child = collectOfficialEndpoints(moduleMap, block.subclass, nextSegments, missingModules, [
        ...callStack,
        moduleName,
      ]);
      missingModules = child.missing;
      endpoints.push(...child.endpoints);
    } else if (block.method) {
      const fullPath = nextSegments.length > 0 ? `/${nextSegments.join("/")}` : "/";
      endpoints.push({
        path: fullPath,
        method: block.method,
        module: moduleName,
        name: block.name,
      });
    }
  }

  return { endpoints, missing: missingModules };
}

interface IrGroup {
  id: string;
  path: string;
  endpoints?: IrEndpoint[];
  children?: IrGroup[];
}

interface IrEndpoint {
  path: string;
  httpMethod: string;
  groupId: string;
}

async function loadScrapedEndpoints(irPath: string): Promise<ScrapedEndpoint[]> {
  const content = await fs.readFile(irPath, "utf8");
  const data = JSON.parse(content) as { groups: IrGroup[] };
  const results: ScrapedEndpoint[] = [];

  const walk = (group: IrGroup) => {
    if (group.endpoints) {
      for (const endpoint of group.endpoints) {
        if (!endpoint?.path || !endpoint?.httpMethod) {
          continue;
        }
        results.push({
          path: endpoint.path,
          method: endpoint.httpMethod,
          groupId: group.id,
          groupPath: group.path,
        });
      }
    }

    if (group.children) {
      for (const child of group.children) {
        walk(child);
      }
    }
  };

  for (const group of data.groups ?? []) {
    walk(group);
  }

  return results;
}

function buildMethodCounts(endpoints: { method: string }[]): Record<string, number> {
  return endpoints.reduce<Record<string, number>>((acc, endpoint) => {
    acc[endpoint.method] = (acc[endpoint.method] ?? 0) + 1;
    return acc;
  }, {});
}

function compareEndpoints(official: OfficialEndpoint[], scraped: ScrapedEndpoint[]): ComparisonResult {
  const scrapedMap = new Map<string, ScrapedEndpoint>();
  for (const endpoint of scraped) {
    scrapedMap.set(`${endpoint.method} ${endpoint.path}`, endpoint);
  }

  const officialMap = new Map<string, OfficialEndpoint>();
  for (const endpoint of official) {
    officialMap.set(`${endpoint.method} ${endpoint.path}`, endpoint);
  }

  const shared: OfficialEndpoint[] = [];
  const officialOnly: OfficialEndpoint[] = [];

  for (const endpoint of official) {
    const key = `${endpoint.method} ${endpoint.path}`;
    if (scrapedMap.has(key)) {
      shared.push(endpoint);
    } else {
      officialOnly.push(endpoint);
    }
  }

  const scrapedOnly: ScrapedEndpoint[] = [];
  for (const endpoint of scraped) {
    const key = `${endpoint.method} ${endpoint.path}`;
    if (!officialMap.has(key)) {
      scrapedOnly.push(endpoint);
    }
  }

  return {
    officialEndpoints: official,
    scrapedEndpoints: scraped,
    shared,
    officialOnly,
    scrapedOnly,
    officialByMethod: buildMethodCounts(official),
    scrapedByMethod: buildMethodCounts(scraped),
  };
}

function formatDiffEntries<T extends { method: string; path: string }>(entries: T[], limit?: number): string {
  if (entries.length === 0) {
    return "  (none)";
  }

  const slice = limit ? entries.slice(0, limit) : entries;
  const lines = slice.map((entry) => `  - ${entry.method.padEnd(6)} ${entry.path}`);
  if (limit && entries.length > limit) {
    lines.push(`  ... ${entries.length - limit} more`);
  }
  return lines.join("\n");
}

function buildTopLevelCounts<T extends { path: string }>(entries: T[]): Record<string, number> {
  return entries.reduce<Record<string, number>>((acc, entry) => {
    const [, firstSegment = ""] = entry.path.split("/");
    const key = firstSegment || "/";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const officialRoots = options.officialRoots;
  const irPath = options.irPath;

  const moduleIndex = await buildModuleIndex(officialRoots);
  const officialResult = collectOfficialEndpoints(moduleIndex, "PVE::API2");
  const official = officialResult.endpoints;
  const missingModules = officialResult.missing;

  const scraped = await loadScrapedEndpoints(irPath);
  const comparison = compareEndpoints(official, scraped);

  const topLevelOfficial = buildTopLevelCounts(official);
  const topLevelScraped = buildTopLevelCounts(scraped);

  const summary = {
    counts: {
      official: official.length,
      scraped: scraped.length,
      shared: comparison.shared.length,
      officialOnly: comparison.officialOnly.length,
      scrapedOnly: comparison.scrapedOnly.length,
    },
    methods: {
      official: comparison.officialByMethod,
      scraped: comparison.scrapedByMethod,
    },
    topLevel: {
      official: topLevelOfficial,
      scraped: topLevelScraped,
    },
    missingModules: Array.from(missingModules).sort(),
  };

  if (missingModules.size > 0) {
    console.log("=== Missing module definitions ===");
    for (const moduleName of summary.missingModules) {
      console.log(`  - ${moduleName}`);
    }
    console.log("");
  }

  console.log("=== Endpoint counts ===");
  console.log(`Official API definitions: ${summary.counts.official}`);
  console.log(`Scraped API viewer entries: ${summary.counts.scraped}`);
  console.log(`Shared endpoints: ${summary.counts.shared}`);
  console.log(`Only in official sources: ${summary.counts.officialOnly}`);
  console.log(`Only in scraped viewer: ${summary.counts.scrapedOnly}`);
  console.log("");

  console.log("=== HTTP method distribution (official) ===");
  for (const [method, count] of Object.entries(summary.methods.official)) {
    console.log(`  ${method.padEnd(6)} ${count}`);
  }
  console.log("");

  console.log("=== HTTP method distribution (scraped) ===");
  for (const [method, count] of Object.entries(summary.methods.scraped)) {
    console.log(`  ${method.padEnd(6)} ${count}`);
  }
  console.log("");

  console.log("=== Top-level path coverage (official) ===");
  for (const [segment, count] of Object.entries(summary.topLevel.official)) {
    console.log(`  /${segment} -> ${count}`);
  }
  console.log("");

  console.log("=== Top-level path coverage (scraped) ===");
  for (const [segment, count] of Object.entries(summary.topLevel.scraped)) {
    console.log(`  /${segment} -> ${count}`);
  }
  console.log("");

  console.log("=== Endpoints only present in official sources ===");
  console.log(formatDiffEntries(comparison.officialOnly, options.limit ?? 20));
  console.log("");

  console.log("=== Endpoints only present in scraped viewer ===");
  console.log(formatDiffEntries(comparison.scrapedOnly, options.limit ?? 20));
  console.log("");

  if (options.output) {
    const outputPayload = {
      ...summary,
      officialOnly: comparison.officialOnly,
      scrapedOnly: comparison.scrapedOnly,
    };
    await fs.mkdir(path.dirname(options.output), { recursive: true });
    await fs.writeFile(options.output, JSON.stringify(outputPayload, null, 2));
    console.log(`Wrote comparison details to ${options.output}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

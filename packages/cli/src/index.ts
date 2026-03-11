#!/usr/bin/env node
/**
 * OpenBrain CLI
 * Cross-AI memory system. Store and search memories across all AI tools.
 */

const args = process.argv.slice(2);
const command = args[0];

function printUsage(): void {
  console.log(`
OpenBrain - Cross-AI Memory System

Usage:
  openbrain setup                                    Interactive setup wizard
  openbrain store "memory text" [options]             Store a memory
  openbrain search "query" [options]                  Search memories
  openbrain list [options]                            List recent memories
  openbrain stats                                    Brain statistics

Store options:
  --category <cat>    Category (company|contact|interaction|decision|insight|task|preference|project)
  --tags <t1,t2>      Comma-separated tags
  --source <src>      Source identifier (default: cli)
  --summary <text>    Short summary

Search options:
  --limit <n>         Max results (default: 5)
  --source <src>      Filter by source
  --category <cat>    Filter by category
  --threshold <n>     Similarity threshold 0-1 (default: 0.5)

List options:
  --limit <n>         Max results (default: 20)
  --source <src>      Filter by source
`);
}

function parseOptions(args: string[]): Record<string, string> {
  const opts: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length) {
      opts[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return opts;
}

async function main(): Promise<void> {
  if (!command || command === "--help" || command === "-h") {
    printUsage();
    return;
  }

  switch (command) {
    case "setup": {
      const { setup } = await import("./commands/setup.js");
      await setup();
      break;
    }

    case "store": {
      const content = args[1];
      if (!content) {
        console.error("Usage: openbrain store \"memory text\" [--category insight --tags tag1,tag2]");
        process.exit(1);
      }
      const opts = parseOptions(args.slice(2));
      const { store } = await import("./commands/store.js");
      await store(content, opts);
      break;
    }

    case "search": {
      const query = args[1];
      if (!query) {
        console.error("Usage: openbrain search \"query\" [--limit 5]");
        process.exit(1);
      }
      const opts = parseOptions(args.slice(2));
      const { search } = await import("./commands/search.js");
      await search(query, opts);
      break;
    }

    case "list": {
      const opts = parseOptions(args.slice(1));
      const { list } = await import("./commands/list.js");
      await list(opts);
      break;
    }

    case "stats": {
      const { stats } = await import("./commands/stats.js");
      await stats();
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

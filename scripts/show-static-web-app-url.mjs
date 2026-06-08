import { spawnSync } from "node:child_process";

function quoteShellArg(value) {
  return `"${String(value).replace(/(["\\])/g, "\\$1")}"`;
}

function run(command, args) {
  const result =
    process.platform === "win32"
      ? spawnSync([command, ...args.map(quoteShellArg)].join(" "), {
          encoding: "utf8",
          shell: true,
        })
      : spawnSync(command, args, { encoding: "utf8" });

  if (result.status !== 0) {
    const message =
      result.error?.message ||
      result.stderr?.trim() ||
      result.stdout?.trim() ||
      "";
    throw new Error(message || `${command} ${args.join(" ")} failed.`);
  }

  return result.stdout.trim();
}

function parseAzdEnv(output) {
  const values = new Map();

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    try {
      values.set(key, JSON.parse(rawValue));
    } catch {
      values.set(key, rawValue.replace(/^"|"$/g, ""));
    }
  }

  return values;
}

const env = parseAzdEnv(run("azd", ["env", "get-values"]));
const environmentName = env.get("AZURE_ENV_NAME");
const resourceGroup =
  env.get("AZURE_RESOURCE_GROUP") ?? `rg-${environmentName}`;

if (!environmentName) {
  throw new Error(
    "AZURE_ENV_NAME was not found. Run this from an azd environment.",
  );
}

let staticWebAppName = env.get("AZURE_STATIC_WEB_APP_NAME");
if (!staticWebAppName) {
  staticWebAppName = run("az", [
    "resource",
    "list",
    "--resource-group",
    resourceGroup,
    "--resource-type",
    "Microsoft.Web/staticSites",
    "--query",
    "[0].name",
    "-o",
    "tsv",
  ]);
}

if (!staticWebAppName) {
  throw new Error(
    `No Static Web App found in resource group ${resourceGroup}.`,
  );
}

const hostname = run("az", [
  "resource",
  "show",
  "--resource-group",
  resourceGroup,
  "--name",
  staticWebAppName,
  "--resource-type",
  "Microsoft.Web/staticSites",
  "--query",
  "properties.defaultHostname",
  "-o",
  "tsv",
]);

if (!hostname) {
  throw new Error(
    `Static Web App ${staticWebAppName} does not have a hostname yet.`,
  );
}

const url = hostname.startsWith("http") ? hostname : `https://${hostname}`;
console.log(url);

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stage = await mkdtemp(join(tmpdir(), "marvel-production-entry-"));
const seen = new Set();
let jsonFiles = 0;

function sourcePath(importer, specifier) {
  const path = resolve(dirname(importer), specifier);
  const candidates =
    extname(path) === ".js"
      ? [path.replace(/\.js$/, ".ts"), path.replace(/\.js$/, ".tsx"), path]
      : [path, `${path}.ts`, `${path}.tsx`, join(path, "index.ts")];
  const actual = candidates.find(existsSync);
  assert(
    actual,
    `Missing source dependency ${specifier} from ${relative(root, importer)}`,
  );
  const local = relative(root, actual);
  assert(
    !local.startsWith(`..${sep}`) && local !== "..",
    "Entry dependency escaped the project",
  );
  return actual;
}

function imports(source, path) {
  const result = new Set();
  const ast = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.JS,
  );
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      result.add(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      ts.isStringLiteral(node.arguments[0])
    )
      result.add(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return [...result].filter((specifier) => specifier.startsWith("."));
}

async function emit(path) {
  if (seen.has(path)) return;
  seen.add(path);
  const destination = join(
    stage,
    relative(root, path).replace(/\.tsx?$/, ".js"),
  );
  await mkdir(dirname(destination), { recursive: true });
  if (extname(path) === ".json") {
    await copyFile(path, destination);
    jsonFiles++;
    return;
  }
  const input = await readFile(path, "utf8");
  const emitted = /\.tsx?$/.test(path)
    ? ts.transpileModule(input, {
        fileName: path,
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.ReactJSX,
          verbatimModuleSyntax: true,
        },
        reportDiagnostics: true,
      })
    : { outputText: input, diagnostics: [] };
  const errors =
    emitted.diagnostics?.filter(
      (d) => d.category === ts.DiagnosticCategory.Error,
    ) || [];
  assert.equal(
    errors.length,
    0,
    ts.formatDiagnosticsWithColorAndContext(errors, {
      getCurrentDirectory: () => root,
      getCanonicalFileName: (name) => name,
      getNewLine: () => "\n",
    }),
  );
  // Preserve emitted specifiers and JSON attributes exactly. Rewriting them,
  // bundling, or using a TS loader would hide the native serverless failure.
  await writeFile(destination, emitted.outputText);
  for (const specifier of imports(emitted.outputText, path))
    await emit(sourcePath(path, specifier));
}

try {
  await writeFile(join(stage, "package.json"), '{"type":"module"}\n');
  await emit(join(root, "api/account.ts"));
  const runner = join(stage, "verify.mjs");
  await writeFile(
    runner,
    `
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
globalThis.fetch = () => { throw Error("Production entry smoke attempted a network request"); };
const { default: handler } = await import("./api/account.js");
assert.equal(typeof handler, "function");
let body;
const headers = {};
const request = { method: "GET", headers: { host: "production-entry.test" }, socket: { remoteAddress: "127.0.0.1" } };
const response = { statusCode: 0, setHeader(name, value) { headers[name] = value; }, end(value) { body = JSON.parse(value); } };
await handler(request, response);
assert.equal(response.statusCode, 200);
assert.deepEqual(body, { user: null, library: { decks: [], missions: [] }, storage: "unavailable" });
assert.equal(headers["Cache-Control"], "no-store, private");
assert.equal(existsSync(process.env.ACCOUNTS_DB_PATH), false, "Production request created local SQLite storage");
console.log(JSON.stringify({ status: response.statusCode, available: false, configured: false, storage: body.storage }));
`,
  );
  const child = spawnSync(process.execPath, [runner], {
    cwd: stage,
    // Do not inherit credentials, storage configuration, NODE_OPTIONS loaders,
    // or development flags from the caller's shell.
    env: {
      NODE_ENV: "production",
      VERCEL: "1",
      ACCOUNTS_DB_PATH: join(stage, "forbidden.sqlite"),
    },
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 1_000_000,
  });
  assert.ifError(child.error);
  assert.equal(
    child.status,
    0,
    `Native Node production entry failed:\n${child.stderr}\n${child.stdout}`,
  );
  const response = JSON.parse(child.stdout.trim());
  console.log(
    JSON.stringify({
      ...response,
      modules: seen.size - jsonFiles,
      jsonFiles,
      nativeNode: process.version,
    }),
  );
} finally {
  await rm(stage, { recursive: true, force: true });
}

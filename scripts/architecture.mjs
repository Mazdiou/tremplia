// Met à jour docs/architecture.html (schéma de l'architecture, gardé hors du
// dépôt) à partir du code :
// - compteurs (routes, tables, fonctions SQL, migrations, tests), commit, date ;
// - routes API : méthodes, rôle (commentaire au-dessus de chaque méthode),
//   contrôle d'accès, fonctions serveur appelées, modules serveur ;
// - modules : fichiers de chaque module et liens d'import entre modules ;
// - tables : colonnes, clés, liens, temps réel, tests pgTAP ;
// - dépendances npm : version demandée et installée, fichiers qui les importent.
// Les textes écrits à la main (descriptions des modules et des tables, flux,
// sécurité, infrastructure) sont gardés. Ce qui est nouveau et demande une
// description ou une place est signalé à la fin.
//
//   node scripts/architecture.mjs           met à jour le fichier
//   node scripts/architecture.mjs --check   affiche seulement les écarts

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "docs/architecture.html");
const CHECK = process.argv.includes("--check");
const BLOCK = /(<script id="architecture-data" type="application\/json">)([\s\S]*?)(<\/script>)/;

if (!existsSync(FILE)) {
  console.error("docs/architecture.html introuvable (le dossier docs/ est hors du dépôt).");
  process.exit(1);
}
const html = readFileSync(FILE, "utf8");
const data = JSON.parse(html.match(BLOCK)[2]);
const view = (id) => data.views.find((v) => v.id === id);
const changes = [];
const todo = [];
const note = (list, text) => list.push(text);

// Outils ---------------------------------------------------------------------

const read = (p) => readFileSync(join(ROOT, p), "utf8");
function walk(dir, out = []) {
  for (const f of readdirSync(join(ROOT, dir))) {
    const p = `${dir}/${f}`;
    if (statSync(join(ROOT, p)).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const sortFr = (a, b) => a.localeCompare(b, "fr");
const unique = (list) => [...new Set(list)];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Commentaire « // … » d'un bloc de lignes, en une phrase
const commentText = (lines) =>
  lines
    .map((l) => l.replace(/^\s*\/\/\s?/, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

// Premier bloc de commentaires après les imports d'un fichier
function headerComment(text) {
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && /^(import\b|\s*$|"use |\s+\w|\}\s*from|\s*\}|export \{|export \*)/.test(lines[i])) {
    if (/^\s*\/\//.test(lines[i])) break;
    i++;
  }
  const block = [];
  while (i < lines.length && /^\s*\/\//.test(lines[i])) block.push(lines[i++]);
  return commentText(block);
}

// Imports d'un fichier : [{ names: [nom local, …], from, typeOnly }]. Les
// noms ne comptent que les valeurs (pas les types).
function imports(text) {
  const out = [];
  for (const m of text.matchAll(/import\s+(type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']/g)) {
    if (m[1]) {
      out.push({ names: [], from: m[3], typeOnly: true });
      continue;
    }
    const spec = m[2];
    const names = [];
    const braces = spec.match(/\{([\s\S]*)\}/);
    if (braces) {
      for (const part of braces[1].split(",")) {
        const p = part.trim();
        if (!p || p.startsWith("type ")) continue;
        names.push(p.split(/\s+as\s+/).pop().trim());
      }
    }
    const def = spec.replace(/\{[\s\S]*\}/, "").replace(/,/g, "").trim();
    if (def && !def.startsWith("*")) names.push(def);
    out.push({ names, from: m[3] });
  }
  for (const m of text.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) out.push({ names: [], from: m[1] });
  return out;
}

// Chemin d'un import vers un fichier de src (null : paquet npm)
function resolveImport(from, spec) {
  let base;
  if (spec.startsWith("@/")) base = `src/${spec.slice(2)}`;
  else if (spec.startsWith(".")) base = relative(ROOT, resolve(ROOT, dirname(from), spec)).replaceAll("\\", "/");
  else return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const p = base + ext;
    if (existsSync(join(ROOT, p)) && statSync(join(ROOT, p)).isFile()) return p;
  }
  return null;
}
const packageOf = (spec) =>
  spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];

const SRC = walk("src");
const CODE = SRC.filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.ts$/.test(f) && !/\.d\.ts$/.test(f));
const MIGRATIONS = readdirSync(join(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
const SQL = MIGRATIONS.map((f) => ({ file: f, text: read(`supabase/migrations/${f}`) }));
const SQL_ALL = SQL.map((m) => m.text).join("\n");

// 1. Routes API ----------------------------------------------------------------

const api = view("api");
const GUARDS = [
  ["admin", /\brequireApiPlatformAdmin\(/],
  ["cron", /\bisCronAuthorized\(/],
  ["case", /\bauthorizeCase\(/],
  ["perm", /\brequireApiPermission\(\s*["'](\w+)["']/],
  ["owner", /\brequireApiOwner\(/],
  ["member", /\brequireApiMember\(/],
  ["student", /\brequireApiStudent\(/],
  ["link", /\bopenedByEmailLink\(/],
  ["session", /\bauth\.getUser\(/],
];
// Contrôle commun à toutes les routes d'un dossier : représenté par le nœud
// « g:case », pas par un lien vers son module
const GUARD_FUNCTIONS = new Set(["authorizeCase"]);
const CASE_GROUPS = [
  [/^(documents|document-folders|document-requests)\b/, "cases-documents"],
  [/^external-accounts\b/, "cases-external"],
  [/^notes\b/, "cases-notes"],
  [/^programs\b/, "cases-programs"],
  [/^(motivation-letter|student-access)\b/, "cases-student"],
  [/^messages\b/, "cases-messages"],
  [/^tasks\b/, "cases-tasks"],
  [/^payments\b/, "cases-payments"],
];
function routeGroup(path) {
  const rest = path.match(/^\/api\/cases\/\[id\]\/(.+)$/)?.[1];
  if (rest) return CASE_GROUPS.find(([re]) => re.test(rest))?.[1] ?? "cases";
  return path.split("/")[2];
}
const badgeOf = Object.fromEntries(
  Object.entries(api.facetLabels.guard).map(([k, v]) => [k, `Accès : ${v}`]),
);

function describeRoute(file) {
  const text = read(file);
  const lines = text.split(/\r?\n/);
  const methods = [];
  const parts = [];
  lines.forEach((line, i) => {
    const m = line.match(/^export (?:(?:async )?function|const) (GET|POST|PUT|PATCH|DELETE)\b/);
    if (!m) return;
    methods.push(m[1]);
    const block = [];
    for (let j = i - 1; j >= 0 && /^\s*\/\//.test(lines[j]); j--) block.unshift(lines[j]);
    if (block.length) parts.push(`${m[1]} : ${commentText(block)}`);
  });
  // Sans commentaire par méthode : celui du haut du fichier (s'il y en a un)
  const desc = parts.length ? parts.join(" — ") : headerComment(text) || undefined;

  let guard = "public";
  for (const [name, re] of GUARDS) {
    const m = text.match(re);
    if (m) {
      guard = name === "perm" ? `perm:${m[1]}` : name;
      break;
    }
  }

  // Fonctions des modules serveur (features/*/server) appelées, dans
  // l'ordre des imports
  const calls = [];
  for (const imp of imports(text)) {
    const target = resolveImport(file, imp.from);
    if (!target || !/^src\/features\/[^/]+\/server\//.test(target)) continue;
    for (const name of imp.names) {
      if (new RegExp(`\\b${name}\\(`).test(text)) calls.push({ name, module: target });
    }
  }
  return { methods, desc, guard, calls };
}

const routeFiles = SRC.filter((f) => /^src\/app\/api\/.*route\.ts$/.test(f));
const oldRoutes = new Map(api.nodes.filter((n) => n.id.startsWith("r:")).map((n) => [n.id, n]));
const oldModules = new Map(api.nodes.filter((n) => n.id.startsWith("m:")).map((n) => [n.id, n]));
const routeNodes = [];
const moduleUse = new Map();
const apiEdges = [];
for (const file of routeFiles.sort(sortFr)) {
  const path = file.replace(/^src\/app/, "").replace(/\/route\.ts$/, "");
  const id = `r:${path}`;
  const r = describeRoute(file);
  const work = r.calls.filter((c) => !GUARD_FUNCTIONS.has(c.name));
  const modules = unique(work.map((c) => c.module));
  const node = {
    id,
    label: path,
    short: path.replace(/^\/api/, ""),
    type: "api",
    layer: "application",
    col: "routes",
    group: routeGroup(path),
    methods: r.methods,
    guard: [r.guard],
    badge: badgeOf[r.guard] ?? `Accès : ${r.guard}`,
    path: file,
    ...(r.desc ? { desc: r.desc } : {}),
  };
  if (r.calls.length) {
    node.details = r.calls.map((c) => `Appelle ${c.name}() dans ${c.module.replace(/^src\//, "")}`);
    node.module = modules.map((m) => m.replace(/^src\/features\//, "")).join(", ");
  }
  routeNodes.push(node);
  if (!oldRoutes.has(id)) note(changes, `route ajoutée : ${path}`);
  else if (!same(oldRoutes.get(id), node)) note(changes, `route mise à jour : ${path}`);
  if (!api.groups[node.group]) note(todo, `groupe de routes inconnu « ${node.group} » (${path}) : à ajouter dans api.groups`);
  apiEdges.push({ from: `g:${r.guard}`, to: id, kind: "guard" });
  for (const m of modules) {
    apiEdges.push({ from: id, to: `m:${m}`, kind: "call" });
    const names = moduleUse.get(m) ?? [];
    names.push(...work.filter((c) => c.module === m).map((c) => c.name));
    moduleUse.set(m, names);
  }
  if (!api.nodes.some((n) => n.id === `g:${r.guard}`)) note(todo, `contrôle d'accès « ${r.guard} » sans nœud g: (${path})`);
}
for (const id of oldRoutes.keys()) if (!routeNodes.some((n) => n.id === id)) note(changes, `route retirée : ${id.slice(2)}`);

const moduleNodes = [...moduleUse.keys()].sort(sortFr).map((m) => {
  const id = `m:${m}`;
  const old = oldModules.get(id);
  const text = read(m);
  const exported = [...text.matchAll(/^export (?:async )?(?:function|const|class) (\w+)/gm)].map((x) => x[1]);
  const desc = old?.desc || headerComment(text);
  if (!old) note(changes, `module serveur ajouté : ${m}`);
  if (!desc) note(todo, `module serveur sans description : ${m}`);
  return {
    id,
    label: m.replace(/^src\/features\//, ""),
    type: "domain",
    layer: "domaine",
    col: "modules",
    path: m,
    sub: "",
    desc,
    details: [
      `Utilisé par les routes : ${unique(moduleUse.get(m)).sort(sortFr).join(", ")}`,
      `Exporte : ${exported.join(", ")}`,
    ],
    guard: ["—"],
  };
});
for (const id of oldModules.keys()) if (!moduleNodes.some((n) => n.id === id)) note(changes, `module serveur retiré : ${id.slice(2)}`);
api.nodes = [...api.nodes.filter((n) => n.id.startsWith("g:")), ...routeNodes, ...moduleNodes];
api.edges = unique(apiEdges.map((e) => JSON.stringify(e))).map((e) => JSON.parse(e));

// 2. Modules et liens d'import (vue « layers ») ----------------------------------

const layers = view("layers");
const fileModule = new Map();
for (const n of layers.nodes) for (const f of n.files ?? []) fileModule.set(`src/${f}`, n.id);
const byPrefix = layers.nodes.filter((n) => n.path).sort((a, b) => b.path.length - a.path.length);
const moduleFor = (file) => {
  if (fileModule.has(file)) return fileModule.get(file);
  const n = byPrefix.find((x) => file === x.path || file.startsWith(`${x.path}/`));
  return n?.id ?? null;
};
// Domaine de features/ sans module : nouveau module, à décrire
for (const dir of readdirSync(join(ROOT, "src/features"))) {
  const path = `src/features/${dir}`;
  if (layers.nodes.some((n) => n.path === path)) continue;
  layers.nodes.push({
    id: `mod:features/${dir}`,
    label: dir,
    type: "domain",
    layer: "domaine",
    col: "features",
    group: "transverse",
    path,
    desc: "",
    files: [],
  });
  byPrefix.unshift(layers.nodes.at(-1));
  byPrefix.sort((a, b) => b.path.length - a.path.length);
  note(changes, `module ajouté : features/${dir}`);
}
const filesOf = new Map(layers.nodes.map((n) => [n.id, []]));
for (const f of CODE) {
  const id = moduleFor(f);
  if (id) filesOf.get(id).push(f.replace(/^src\//, ""));
  else note(todo, `fichier sans module : ${f}`);
}
for (const n of layers.nodes) {
  const files = filesOf.get(n.id).sort();
  const added = files.filter((f) => !(n.files ?? []).includes(f));
  const removed = (n.files ?? []).filter((f) => !files.includes(f));
  if (added.length || removed.length) {
    note(changes, `${n.id} : ${added.length} fichier(s) ajouté(s), ${removed.length} retiré(s)`);
  }
  n.files = files;
  if (n.type === "api") n.desc = n.desc.replace(/\d+ fichier\(s\)/, `${files.length} fichier(s)`);
  if (!n.desc) note(todo, `module sans description ni groupe choisi : ${n.id}`);
}
const UTIL = new Set(["mod:lib/core", "mod:components/ui", "mod:components/common", "mod:hooks", "mod:config"]);
const importCount = new Map();
for (const f of CODE) {
  const from = moduleFor(f);
  for (const imp of imports(read(f))) {
    const target = resolveImport(f, imp.from);
    const to = target && moduleFor(target);
    if (!from || !to || from === to) continue;
    const key = `${from}|${to}`;
    importCount.set(key, (importCount.get(key) ?? 0) + 1);
  }
}
const oldLayerEdges = new Map(layers.edges.map((e) => [`${e.from}|${e.to}`, e]));
layers.edges = [...importCount]
  .sort(([a], [b]) => sortFr(a, b))
  .map(([key, count]) => {
    const [from, to] = key.split("|");
    const kind =
      oldLayerEdges.get(key)?.kind ??
      (UTIL.has(to) ? "util" : from.startsWith("mod:features/") && to.startsWith("mod:features/") ? "cross" : "main");
    return { from, to, label: `${count} import${count > 1 ? "s" : ""}`, kind };
  });

// 3. Tables (vue « data ») --------------------------------------------------------

// Parties d'une liste séparée par des virgules, hors parenthèses
function splitTop(text) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => p.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim()).filter(Boolean);
}
const refName = (s) => s.replace(/^public\./, "").replace(/"/g, "");
const KEYWORDS = /^(not|null|default|primary|references|check|unique|generated|constraint|collate)$/i;
const tables = new Map();
function addColumn(table, def) {
  const tokens = def.split(" ");
  const name = tokens[0];
  const typeTokens = [];
  for (const t of tokens.slice(1)) {
    if (KEYWORDS.test(t)) break;
    typeTokens.push(t);
  }
  const field = { name, type: typeTokens.join(" ").toLowerCase() };
  if (/\bprimary key\b/i.test(def)) field.pk = true;
  const ref = def.match(/\breferences ([\w."]+)/i);
  if (ref) Object.assign(field, { fk: true, ref: refName(ref[1]) });
  table.fields.push(field);
}
function addConstraint(table, def) {
  const pk = def.match(/\bprimary key \(([^)]+)\)/i);
  if (pk) for (const c of pk[1].split(",")) {
    const f = table.fields.find((x) => x.name === c.trim());
    if (f) f.pk = true;
  }
  const fk = def.match(/\bforeign key \(([^)]+)\) references ([\w."]+)/i);
  if (fk) {
    const f = table.fields.find((x) => x.name === fk[1].split(",")[0].trim());
    if (f && !f.fk) Object.assign(f, { fk: true, ref: refName(fk[2]) });
  }
}
for (const { file, text } of SQL) {
  const clean = text.replace(/--[^\n]*/g, "");
  for (const m of clean.matchAll(/create table (?:if not exists )?public\.(\w+)\s*\(([\s\S]*?)\n\);/g)) {
    const table = { name: m[1], file, fields: [] };
    for (const part of splitTop(m[2])) {
      if (/^(constraint|primary key|foreign key|unique|check|exclude)\b/i.test(part)) addConstraint(table, part);
      else addColumn(table, part);
    }
    tables.set(m[1], table);
  }
  for (const m of clean.matchAll(/alter table (?:only )?public\.(\w+)\s+([\s\S]*?);/g)) {
    const table = tables.get(m[1]);
    if (!table || /^\s*(enable|disable|force|owner|replica)/i.test(m[2])) continue;
    for (const part of splitTop(m[2])) {
      const add = part.match(/^add column (?:if not exists )?(.+)$/i);
      const drop = part.match(/^drop column (?:if exists )?(\w+)/i);
      const constraint = part.match(/^add (constraint \w+ .+)$/i);
      if (add) addColumn(table, add[1]);
      else if (drop) table.fields = table.fields.filter((f) => f.name !== drop[1]);
      else if (constraint) addConstraint(table, constraint[1]);
    }
  }
}
const realtime = new Set(
  [...SQL_ALL.matchAll(/alter publication supabase_realtime add table ([^;]+);/g)].flatMap((m) =>
    m[1].split(",").map((t) => refName(t.trim())),
  ),
);
const rls = new Set([...SQL_ALL.matchAll(/alter table public\.(\w+) enable row level security/g)].map((m) => m[1]));

const dataView = view("data");
const GENERATED_DETAIL = /^(RLS activé|Créée par|Publiée en temps réel|Tests pgTAP)/;
for (const t of [...tables.values()]) {
  const id = `t:${t.name}`;
  let node = dataView.nodes.find((n) => n.id === id);
  if (!node) {
    const comment = SQL.find((m) => m.file === t.file).text.match(
      new RegExp(`((?:--[^\\n]*\\n)+)create table (?:if not exists )?public\\.${t.name}\\b`),
    );
    node = {
      id,
      label: t.name,
      type: "db",
      layer: "donnees",
      col: "c4",
      group: "contenu",
      desc: comment ? commentText(comment[1].split("\n").map((l) => l.replace(/^--/, "//"))) : "",
    };
    dataView.nodes.push(node);
    note(changes, `table ajoutée : ${t.name}`);
    note(todo, `table ${t.name} placée par défaut (colonne c4, groupe « contenu ») : à vérifier`);
  }
  if (node.fields && !same(node.fields, t.fields)) note(changes, `colonnes mises à jour : ${t.name}`);
  node.paths = [`supabase/migrations/${t.file}`];
  node.fields = t.fields;
  const test = `supabase/tests/${t.file.replace(/^\d+_/, "").replace(/\.sql$/, "")}_test.sql`;
  node.details = [
    ...(rls.has(t.name) ? ["RLS activé (comme toutes les tables de public)"] : []),
    `Créée par ${t.file}`,
    ...(realtime.has(t.name) ? ["Publiée en temps réel (supabase_realtime)"] : []),
    ...(existsSync(join(ROOT, test)) ? [`Tests pgTAP : ${test}`] : []),
    ...(node.details ?? []).filter((d) => !GENERATED_DETAIL.test(d)),
  ];
  if (realtime.has(t.name)) node.tag = "temps réel";
  else if (node.tag === "temps réel") delete node.tag;
  if (!node.desc) note(todo, `table sans description : ${t.name}`);
}
for (const n of dataView.nodes) {
  if (n.id.startsWith("t:") && !n.id.includes(".") && !tables.has(n.id.slice(2))) {
    note(changes, `table retirée : ${n.id.slice(2)}`);
  }
}
dataView.nodes = dataView.nodes.filter((n) => !n.id.startsWith("t:") || n.id.includes(".") || tables.has(n.id.slice(2)));

// Liens : une flèche par paire de tables, colonnes réunies. Le genre d'un
// lien existant est gardé ; un nouveau lien suit les règles du schéma.
const AUTHORS = new Set(["profiles", "auth.users"]);
const fkEdges = new Map();
for (const t of tables.values()) {
  const hasParent = t.fields.some((f) => f.fk && f.ref !== "agencies" && !AUTHORS.has(f.ref));
  for (const f of t.fields.filter((x) => x.fk)) {
    const to = `t:${f.ref}`;
    if (!dataView.nodes.some((n) => n.id === to)) continue;
    const key = `t:${t.name}|${to}`;
    const kind =
      AUTHORS.has(f.ref) && !(f.pk && f.name === "id")
        ? f.pk
          ? "structure"
          : "author"
        : f.name === "agency_id" && hasParent
          ? "agency"
          : "structure";
    const e = fkEdges.get(key) ?? { from: `t:${t.name}`, to, cols: [], kind };
    e.cols.push(f.name);
    fkEdges.set(key, e);
  }
}
const keptEdges = dataView.edges.filter((e) => {
  const target = dataView.nodes.find((n) => n.id === e.to);
  // Liens dessinés à la main : stockage, vues SQL
  return e.dashed || e.kind === "view" || !target || target.type !== "db" && target.type !== "external";
});
const oldFk = new Map(dataView.edges.map((e) => [`${e.from}|${e.to}`, e]));
const newFk = [...fkEdges.values()].map((e) => {
  const old = oldFk.get(`${e.from}|${e.to}`);
  if (!old) note(changes, `lien ajouté : ${e.from.slice(2)} → ${e.to.slice(2)} (${e.cols.join(", ")})`);
  return { from: e.from, to: e.to, label: e.cols.join(", "), kind: old?.kind ?? e.kind };
});
for (const e of dataView.edges) {
  if (!keptEdges.includes(e) && !fkEdges.has(`${e.from}|${e.to}`)) note(changes, `lien retiré : ${e.from} → ${e.to}`);
}
dataView.edges = [...newFk, ...keptEdges.filter((e) => !fkEdges.has(`${e.from}|${e.to}`))];

// 4. Dépendances npm ------------------------------------------------------------------

const pkg = JSON.parse(read("package.json"));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
const depsView = view("deps");
const usage = new Map();
for (const f of CODE) {
  for (const imp of imports(read(f))) {
    if (resolveImport(f, imp.from) || imp.from.startsWith("@/") || imp.from.startsWith(".") || imp.from.startsWith("node:")) continue;
    const name = packageOf(imp.from);
    const files = usage.get(name) ?? new Set();
    files.add(f);
    usage.set(name, files);
  }
}
const labelOf = (id) => layers.nodes.find((n) => n.id === id)?.id.replace(/^mod:/, "") ?? "?";
for (const n of depsView.nodes.filter((x) => x.id.startsWith("pkg:"))) {
  const name = n.id.slice(4);
  const p = join(ROOT, "node_modules", name, "package.json");
  const installed = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")).version : "?";
  const sub = `${deps[name] ?? "?"}, installée ${installed}`;
  if (n.sub !== sub) note(changes, `${name} : ${n.sub} → ${sub}`);
  n.sub = sub;
  if (!deps[name]) note(todo, `dépendance retirée de package.json : ${name}`);
  const files = [...(usage.get(name) ?? [])].sort();
  if (files.length) {
    const perModule = new Map();
    for (const f of files) {
      const m = labelOf(moduleFor(f));
      perModule.set(m, [...(perModule.get(m) ?? []), f.replace(/^src\//, "")]);
    }
    n.details = [
      `Importée dans ${files.length} fichier(s), ${perModule.size} module(s)`,
      ...[...perModule].map(([m, list]) => `${m} : ${list.join(", ")}`),
      ...(n.details ?? []).filter((d) => !/^Importée dans|^[\w/-]+ : /.test(d)),
    ];
  }
}
for (const name of Object.keys(deps)) {
  if (!depsView.nodes.some((n) => n.id === `pkg:${name}`)) note(todo, `dépendance absente du schéma : ${name}`);
}

// 5. En-tête et compteurs écrits dans les textes -----------------------------------------

const fnCount = new Set([...SQL_ALL.matchAll(/create (?:or replace )?function public\.(\w+)/g)].map((m) => m[1])).size;
const counts = {
  routes: routeFiles.length,
  tables: tables.size,
  sqlFunctions: fnCount,
  migrations: MIGRATIONS.length,
  unitTests: SRC.filter((f) => /\.test\.ts$/.test(f)).length,
  pgtap: readdirSync(join(ROOT, "supabase/tests")).filter((f) => f.endsWith(".sql")).length,
};
const old = data.meta.counts;
for (const [k, v] of Object.entries(counts)) if (old[k] !== v) note(changes, `compteur ${k} : ${old[k]} → ${v}`);
data.meta.counts = counts;
data.meta.commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
data.meta.generatedOn = new Date().toISOString().slice(0, 10);
// Slogan de l'application (src/config/brand.ts)
const tagline = read("src/config/brand.ts").match(/tagline: "([^"]+)"/)?.[1];
if (tagline) data.meta.subtitle = tagline;
const overview = view("overview");
for (const n of overview.nodes) {
  n.label = n.label
    .replace(/Routes API \(\d+\)/, `Routes API (${counts.routes})`)
    .replace(/\d+ tables, RLS, \d+ fonctions SQL/, `${counts.tables} tables, RLS, ${counts.sqlFunctions} fonctions SQL`);
}

// Écriture ---------------------------------------------------------------------------

// Petits objets sur une ligne, comme le reste du fichier
const isObj = (x) => x !== null && typeof x === "object";
const EXPANDED = new Set(["views", "flows"]);
// `key` : la clé de la valeur ; `itemOf` : la clé du tableau qui la contient
function fmt(v, depth, key, itemOf) {
  if (!isObj(v)) return JSON.stringify(v);
  const one = JSON.stringify(v);
  if (itemOf && !EXPANDED.has(itemOf)) return one;
  const flat = Array.isArray(v) || Object.values(v).every((x) => !isObj(x));
  if (one.length <= 100 || (flat && depth >= 3 && !Array.isArray(v))) return one;
  const pad = "  ".repeat(depth);
  const inner = "  ".repeat(depth + 1);
  if (Array.isArray(v)) {
    return `[\n${v.map((x) => inner + fmt(x, depth + 1, undefined, key)).join(",\n")}\n${pad}]`;
  }
  return `{\n${Object.keys(v)
    .map((k) => `${inner}${JSON.stringify(k)}: ${fmt(v[k], depth + 1, k)}`)
    .join(",\n")}\n${pad}}`;
}

console.log(changes.length ? `Changements :\n- ${changes.join("\n- ")}` : "Aucun changement.");
if (todo.length) console.log(`\nÀ compléter à la main dans docs/architecture.html :\n- ${unique(todo).join("\n- ")}`);
if (!CHECK) {
  writeFileSync(FILE, html.replace(BLOCK, (_, open, _old, close) => `${open}\n${fmt(data, 0)}\n${close}`));
  console.log(`\ndocs/architecture.html mis à jour (commit ${data.meta.commit}).`);
}

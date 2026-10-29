// Relève les textes visibles de l'application (JSX, props d'affichage,
// messages) et signale ceux qui méritent une relecture.
// Usage : node .claude/skills/audit-textes/extract.mjs [dossier] [--flagged] [--json]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const target = process.argv.find((a, i) => i > 1 && !a.startsWith("--")) ?? "src";
const asJson = process.argv.includes("--json");
const onlyFlagged = process.argv.includes("--flagged");

// Props dont la valeur est affichée (ou lue par un lecteur d'écran)
const SHOWN_PROPS = new Set([
  "title", "subtitle", "description", "label", "placeholder", "hint", "aria-label",
  "alt", "text", "message", "emptyText", "confirmLabel", "cancelLabel", "children",
]);
// Props techniques : jamais du texte
const CODE_PROPS = new Set([
  "className", "href", "id", "key", "type", "name", "src", "role", "variant", "size",
  "tone", "rel", "target", "method", "autoComplete", "inputMode", "pattern", "htmlFor",
]);
// Fonctions dont les arguments texte ne sont pas montrés à l'utilisateur
// (journaux, requêtes, DOM, styles)
const CODE_CALLS = new Set([
  "cn", "cva", "require", "import", "fetch", "callApi", "from", "select", "eq", "rpc",
  "dbError", "safely", "reportError", "reportException", "log", "info", "warn", "error",
  "debug", "getItem", "setItem", "querySelector", "matchMedia", "addEventListener",
  "dispatchEvent", "createElement", "setAttribute", "startsWith", "endsWith", "includes",
  "split", "replace", "test", "match",
]);

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|mjs)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) files.push(p);
  }
})(join(ROOT, target));

const decode = (s) =>
  s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");

// Du code (script, HTML, CSS) plutôt qu'une phrase
const looksLikeCode = (s) => {
  if (/function\s*\(|=>|<\/?[a-z]+[\s>]|[{;]\s*[a-z-]+\s*:/.test(s)) return true;
  // Liste de colonnes SQL (« id, first_name, … »)
  if (/^[a-z_*]+(\s*,\s*[a-z_*()]+)*,?$/.test(s) && s.includes("_")) return true;
  // Classes Tailwind : sans accent ni majuscule, la plupart des mots ont un - ou un :
  const words = s.split(/\s+/);
  if (!/[À-ÿA-Z]/.test(s) && words.filter((w) => /[-:[\]/]/.test(w)).length >= words.length / 2) return true;
  return false;
};

// Ressemble à une phrase française plutôt qu'à un identifiant
const looksLikeText = (s) =>
  !looksLikeCode(s) &&
  /\p{L}/u.test(s) &&
  (/\s/.test(s) || /[À-ÿ]/.test(s)) &&
  !/^[\w./:@#-]+$/.test(s);

const textOf = (node, sf) => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    let s = node.head.text;
    for (const span of node.templateSpans) s += `{${span.expression.getText(sf)}}` + span.literal.text;
    return s;
  }
  return null;
};

function flags(text, kind) {
  const f = [];
  // Les morceaux de code {…} ne comptent ni pour la ponctuation ni pour la longueur
  const prose = text.replace(/\{[^}]*\}/g, "{x}");
  const len = prose.replace(/\{x\}/g, "xxxxxxxx").length;
  if (prose.includes("·")) f.push("point médian");
  if (kind === "description" || kind === "subtitle") {
    if (len > 90) f.push(`long (${len})`);
    if ((prose.match(/[.!?]\s+\S/g) ?? []).length >= 1) f.push("plusieurs phrases");
  } else if (kind === "label" || kind === "title") {
    if (len > 45) f.push(`long (${len})`);
  } else if (len > 140) f.push(`long (${len})`);
  if (/[\p{L}\d)][:;!?](\s|$)/u.test(prose) && !/https?:/.test(prose)) f.push("espace avant : ; ! ? manquante");
  if (/"[^"]+"/.test(prose)) f.push("guillemets droits");
  if (/\.\.\./.test(prose)) f.push("trois points au lieu de …");
  if (/(?<![\p{L}-])(OK|Ok|email|emails|upload|click|cancel|submit|mail)(?![\p{L}-])/u.test(prose))
    f.push("anglicisme ?");
  if (/(?<!\p{L})(tu|ton|ta|tes|toi)(?!\p{L})/iu.test(prose)) f.push("tutoiement ?");
  if (/!\s*$/.test(prose)) f.push("point d'exclamation");
  return f;
}

const out = [];
for (const file of files) {
  const code = readFileSync(file, "utf8");
  const kind = file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, kind);
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const add = (node, raw, k) => {
    const text = decode(raw).replace(/\s+/g, " ").trim();
    if (!text || !looksLikeText(text)) return;
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    out.push({ file: rel, line, kind: k, text, flags: flags(text, k) });
  };
  const isCodeCall = (node) =>
    ts.isCallExpression(node.parent) &&
    CODE_CALLS.has(node.parent.expression.getText(sf).split(".").pop());
  const visit = (node) => {
    if (ts.isJsxText(node)) add(node, node.text, "jsx");
    else if (ts.isJsxAttribute(node) && node.initializer) {
      const prop = node.name.getText(sf);
      if (!CODE_PROPS.has(prop)) {
        const init = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer;
        const t = init && textOf(init, sf);
        if (t !== null && t !== undefined) add(node, t, SHOWN_PROPS.has(prop) ? prop : `prop:${prop}`);
        else if (init) ts.forEachChild(init, visit);
      }
      return;
    } else if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateExpression(node)
    ) {
      const parent = node.parent;
      if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || isCodeCall(node)) return;
      const t = textOf(node, sf);
      if (t !== null) add(node, t, "chaîne");
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

const shown = onlyFlagged ? out.filter((r) => r.flags.length) : out;
if (asJson) console.log(JSON.stringify(shown, null, 2));
else {
  for (const r of shown) {
    const warn = r.flags.length ? `  ⚠ ${r.flags.join(", ")}` : "";
    console.log(`${r.file}:${r.line} [${r.kind}]${warn}\n  ${r.text}`);
  }
  const flagged = out.filter((r) => r.flags.length).length;
  console.log(`\n${out.length} textes relevés, ${flagged} signalés`);
}

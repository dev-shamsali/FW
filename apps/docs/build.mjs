// Static docs generator: ../../docs/*.md -> dist/<page>/index.html (pretty URLs).
// Dependencies: marked (markdown), shiki (build-time syntax highlighting), fontsource (self-hosted fonts).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";
import { createHighlighter } from "shiki";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "../..");
const docsDir = join(repo, "docs");
const out = join(here, "dist");
const cfg = JSON.parse(readFileSync(join(repo, "site.config.json"), "utf8"));
const BASE = process.env.DOCS_BASE ?? "/docs/";
const SITE = (process.env.SITE_URL ?? cfg.siteUrl ?? "").replace(/\/$/, "");
const nav = JSON.parse(readFileSync(join(docsDir, "nav.json"), "utf8"));
const require = createRequire(import.meta.url);

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const strip = (s) =>
  s
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[`*_>#|]/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

const lastUpdated = (name) => {
  const r = spawnSync("git", ["log", "-1", "--format=%cs", "--", `docs/${name}.md`], { cwd: repo, encoding: "utf8" });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : new Date().toISOString().slice(0, 10);
};

const sectionOf = {};
const pages = nav
  .flatMap((s) => s.pages.map((name) => ({ name, section: s.section })))
  .map(({ name, section }) => {
    sectionOf[name] = section;
    const md = readFileSync(join(docsDir, `${name}.md`), "utf8").replace(/\r\n/g, "\n");
    const title = /^# (.+)$/m.exec(md)?.[1] ?? name;
    const body = md.replace(/^# .+\n+/, "");
    const lede = /^(?!#|>|```|\||[-*] |\d+\. )(.+)$/m.exec(body)?.[1] ?? "";
    return { name, section, md, body, title, lede, updated: lastUpdated(name) };
  });

const hashOf = (file) =>
  createHash("sha1")
    .update(readFileSync(join(here, "assets", file)))
    .digest("hex")
    .slice(0, 8);
const CSS = `docs.${hashOf("docs.css")}.css`;
const JS = `docs.${hashOf("docs.js")}.js`;

const url = (name, hash = "") => `${BASE}${name}/${hash}`;

/* ---------- syntax highlighting ---------- */
const LANGS = {
  ts: "typescript",
  typescript: "typescript",
  tsx: "tsx",
  js: "javascript",
  json: "json",
  bash: "bash",
  sh: "bash",
  shell: "bash",
  yaml: "yaml",
  yml: "yaml",
  dockerfile: "docker",
  docker: "docker",
  text: "text",
  md: "markdown",
  markdown: "markdown",
  env: "bash",
};
const highlighter = await createHighlighter({
  themes: ["github-light", "github-dark"],
  langs: ["typescript", "tsx", "javascript", "json", "bash", "yaml", "docker", "markdown"],
});
const ICON = {
  term: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2.5 4.5 6 8l-3.5 3.5M8 12h5.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  file: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 1.75h5l3 3v9.5H4z" stroke-linejoin="round"/></svg>',
  copy: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" width="14" height="14"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 3.5v-1h-8v8h1"/></svg>',
};
const LABEL = {
  bash: "Terminal",
  typescript: "TypeScript",
  tsx: "TSX",
  javascript: "JavaScript",
  json: "JSON",
  yaml: "YAML",
  docker: "Dockerfile",
  markdown: "Markdown",
  text: "Output",
};

function codeBlock(text, info) {
  const [rawLang = "", ...meta] = (info ?? "").split(/\s+/);
  const lang = LANGS[rawLang.toLowerCase()] ?? "text";
  const verified = meta.includes("verify");
  const body = text.replace(/\n$/, "");
  const html =
    lang === "text"
      ? `<pre class="shiki" tabindex="0"><code>${esc(body)}</code></pre>`
      : highlighter.codeToHtml(body, { lang, themes: { light: "github-light", dark: "github-dark" }, defaultColor: false });
  const label = LABEL[lang] ?? lang;
  const icon = lang === "bash" ? ICON.term : ICON.file;
  const badge = verified
    ? '<span class="badge" title="This example is type-checked against the real @rheajs/core build by the test suite.">Type-checked</span>'
    : "";
  return `<figure class="code"><figcaption>${icon}<span>${esc(label)}</span>${badge}<button class="copy" type="button">${ICON.copy}<span>Copy</span><span class="sr" hidden> code</span></button></figcaption>${html}</figure>`;
}

/* ---------- markdown ---------- */
const stash = [];
const marked = new Marked({
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const id = slug(text);
      const anchor = depth > 1 ? `<a class="anchor" href="#${id}" aria-label="Link to this section">#</a>` : "";
      return `<h${depth} id="${id}">${text}${anchor}</h${depth}>\n`;
    },
    code({ text, lang }) {
      stash.push(codeBlock(text, lang));
      return `<!--CODE:${stash.length - 1}-->`;
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const m = /^([a-z-]+)\.html(#.+)?$/.exec(href);
      const target = m ? url(m[1], m[2] ?? "") : href;
      const ext = /^https?:/.test(target) ? ' rel="noopener noreferrer"' : "";
      return `<a href="${esc(target)}"${title ? ` title="${esc(title)}"` : ""}${ext}>${text}</a>`;
    },
    blockquote({ tokens }) {
      return `<aside class="callout">${this.parser.parse(tokens)}</aside>\n`;
    },
  },
});
const render = (md) => {
  stash.length = 0;
  let html = marked.parse(md);
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, "</table></div>");
  return html.replace(/<!--CODE:(\d+)-->/g, (_, i) => stash[Number(i)]);
};

/* ---------- search index (per heading) ---------- */
const searchIndex = [];
for (const p of pages) {
  let heading = "",
    anchor = "",
    text = [];
  const flush = () => {
    if (heading) searchIndex.push({ t: p.title, h: heading, u: url(p.name, anchor), x: text.join(" ").slice(0, 1500) });
    text = [];
  };
  for (const tok of marked.lexer(p.body)) {
    if (tok.type === "heading" && tok.depth <= 3) {
      flush();
      heading = strip(tok.text);
      anchor = `#${slug(tok.text)}`;
    } else if (tok.type !== "space" && tok.type !== "code") text.push(strip(tok.raw));
  }
  flush();
  searchIndex.push({ t: p.title, h: "", u: url(p.name), x: strip(p.body).slice(0, 1200) });
}

/* ---------- page template ---------- */
const ICONS = {
  theme:
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10" cy="10" r="3.6"/><path d="M10 1.8v2M10 16.2v2M1.8 10h2M16.2 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" stroke-linecap="round"/></svg>',
  menu: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 6h14M3 10h14M3 14h14" stroke-linecap="round"/></svg>',
  search:
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" width="16" height="16" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4" stroke-linecap="round"/></svg>',
};

const sideNav = (cur) =>
  nav
    .map(
      (s) =>
        `<h2>${esc(s.section)}</h2><ul>${s.pages.map((n) => `<li><a href="${url(n)}"${n === cur ? ' aria-current="page"' : ""}>${esc(pages.find((p) => p.name === n).title)}</a></li>`).join("")}</ul>`,
    )
    .join("");

const toc = (p) => {
  const items = marked.lexer(p.body).filter((t) => t.type === "heading" && (t.depth === 2 || t.depth === 3));
  if (!items.length) return "";
  return `<nav class="toc" aria-label="On this page"><h2>On this page</h2><ul>${items.map((t) => `<li><a class="l${t.depth}" href="#${slug(t.text)}">${esc(strip(t.text))}</a></li>`).join("")}</ul>${cfg.repoUrl ? `<a class="edit" href="${cfg.repoUrl}/edit/main/docs/${p.name}.md" rel="noopener noreferrer">Edit this page on GitHub</a>` : ""}</nav>`;
};

const desc = (p) => esc(p.lede.replace(/[`*_]/g, "").slice(0, 160) || `Rhea.js documentation: ${p.title}`);

const page = (p, i) => {
  const prev = pages[i - 1],
    next = pages[i + 1];
  const canonical = SITE ? `<link rel="canonical" href="${SITE}${url(p.name)}">` : "";
  const og = `<meta property="og:type" content="article"><meta property="og:site_name" content="Rhea.js"><meta property="og:title" content="${esc(p.title)} | Rhea.js docs"><meta property="og:description" content="${desc(p)}">${SITE ? `<meta property="og:url" content="${SITE}${url(p.name)}">` : ""}<meta name="twitter:card" content="summary">`;
  const ld = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: p.title,
    description: p.lede.replace(/[`*_]/g, ""),
    author: { "@type": "Person", name: cfg.author },
    dateModified: p.updated,
    inLanguage: "en",
  });
  return `<!doctype html>
<html lang="en" data-base="${BASE}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)} | Rhea.js docs</title><meta name="description" content="${desc(p)}">${canonical}${og}
<link rel="icon" href="${BASE}assets/icon.png" type="image/png">
<link rel="preload" href="${BASE}assets/fonts/familjen-grotesk-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<script>try{var t=localStorage.getItem("rhea-theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>
<link rel="stylesheet" href="${BASE}assets/${CSS}"><script type="application/ld+json">${ld}</script></head>
<body><a class="skip" href="#content">Skip to content</a>
<header class="top">
<button id="menu" class="icon-btn menu-btn" type="button" aria-label="Toggle navigation" aria-expanded="false" aria-controls="sidebar">${ICONS.menu}</button>
<a class="brand" href="/"><span class="mark" role="img" aria-label="Rhea.js logo"></span>Rhea.js</a>
<nav class="topnav" aria-label="Primary"><a href="${url("introduction")}" aria-current="page">Docs</a><a href="/">Home</a>${cfg.repoUrl ? `<a href="${cfg.repoUrl}" rel="noopener noreferrer">GitHub</a>` : ""}</nav>
<span class="grow"></span>
<button class="search-btn" type="button" data-open-search aria-label="Search documentation">${ICONS.search}<span>Search docs</span><kbd>Ctrl K</kbd></button>
<button id="theme" class="icon-btn" type="button" aria-label="Change theme">${ICONS.theme}</button>
</header>
<div class="shell">
<nav id="sidebar" class="side" aria-label="Documentation">${sideNav(p.name)}</nav>
<main id="content"><article>
<div class="crumbs"><a href="${url("introduction")}">Docs</a><span aria-hidden="true">/</span><span>${esc(p.section)}</span><span aria-hidden="true">/</span><span class="here" aria-current="page">${esc(p.title)}</span></div>
<h1>${esc(p.title)}</h1>
<p class="updated">Last updated ${p.updated}</p>
${render(p.body)}
<div class="pager">${prev ? `<a class="prev" href="${url(prev.name)}" rel="prev"><small>Previous</small>${esc(prev.title)}</a>` : "<span></span>"}${next ? `<a class="next" href="${url(next.name)}" rel="next"><small>Next</small>${esc(next.title)}</a>` : ""}</div>
</article></main>
${toc(p)}
</div>
<footer class="site"><span>Rhea.js ${esc(cfg.version)} is alpha software. Made by ${esc(cfg.author)}. MIT licensed.</span><a href="/">Home</a><a href="/privacy/">Privacy policy</a></footer>
<dialog id="search" class="search" aria-label="Search documentation"><input id="q" type="search" placeholder="Search the docs" autocomplete="off" aria-label="Search the docs"><ul id="hits" aria-live="polite"></ul></dialog>
<script src="${BASE}assets/${JS}" defer></script>
</body></html>`;
};

/* ---------- write ---------- */
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "assets/fonts"), { recursive: true });
cpSync(join(here, "assets/docs.css"), join(out, "assets", CSS));
cpSync(join(here, "assets/docs.js"), join(out, "assets", JS));
for (const f of ["icon.png", "rhea-mark.png"]) cpSync(join(here, "assets", f), join(out, "assets", f));
for (const [pkg, file] of [
  ["@fontsource-variable/familjen-grotesk", "familjen-grotesk-latin-wght-normal.woff2"],
  ["@fontsource-variable/martian-mono", "martian-mono-latin-wght-normal.woff2"],
]) {
  cpSync(join(dirname(require.resolve(`${pkg}/package.json`)), "files", file), join(out, "assets/fonts", file));
}
pages.forEach((p, i) => {
  mkdirSync(join(out, p.name), { recursive: true });
  writeFileSync(join(out, p.name, "index.html"), page(p, i));
});
writeFileSync(
  join(out, "index.html"),
  `<!doctype html><html lang="en"><meta charset="utf-8"><title>Rhea.js docs</title><meta http-equiv="refresh" content="0;url=${url("introduction")}"><link rel="canonical" href="${SITE}${url("introduction")}"><a href="${url("introduction")}">Rhea.js docs</a></html>`,
);
writeFileSync(join(out, "search.json"), JSON.stringify(searchIndex));
writeFileSync(join(out, "pages.json"), JSON.stringify(pages.map((p) => ({ name: p.name, title: p.title, updated: p.updated }))));
console.log(`Built ${pages.length} pages, ${searchIndex.length} search entries to apps/docs/dist (base ${BASE})`);

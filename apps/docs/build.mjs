// Static docs generator: ../../docs/*.md -> dist/*.html. Only dependency: marked.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";

const here = dirname(fileURLToPath(import.meta.url));
const docsDir = join(here, "../../docs");
const out = join(here, "dist");
const nav = JSON.parse(readFileSync(join(docsDir, "nav.json"), "utf8"));

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const pages = nav
  .flatMap((s) => s.pages)
  .map((name) => {
    const md = readFileSync(join(docsDir, `${name}.md`), "utf8");
    const title = /^# (.+)$/m.exec(md)?.[1] ?? name;
    return { name, md, title };
  });

const marked = new Marked({
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const id = slug(text);
      return `<h${depth} id="${id}">${text}${depth > 1 ? ` <a class="anchor" href="#${id}" aria-label="Link to this section">#</a>` : ""}</h${depth}>\n`;
    },
    code({ text, lang }) {
      const l = (lang ?? "").split(/\s+/)[0];
      return `<pre tabindex="0"><code${l ? ` class="language-${esc(l)}"` : ""}>${esc(text)}</code></pre>\n`;
    },
  },
});

const css = `
:root{--bg:#e8edf0;--fg:#0d1b2a;--muted:#3a4b5c;--line:#c3cfd7;--accent:#8a5a00;--code:#0d1b2a;--codefg:#e6edf2;--side:#f5f8f9}
@media (prefers-color-scheme:dark){:root{--bg:#0a131c;--fg:#e6edf2;--muted:#a9b8c5;--line:#243546;--accent:#f0b83a;--code:#060d14;--codefg:#e6edf2;--side:#101d2a}}
*{box-sizing:border-box}html{scroll-padding-top:5rem}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 system-ui,-apple-system,Segoe UI,sans-serif}
a{color:var(--accent)}a:focus-visible,button:focus-visible,input:focus-visible,pre:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.skip{position:absolute;left:-999px}.skip:focus{left:8px;top:8px;background:var(--bg);padding:.5rem;z-index:10}
header{position:sticky;top:0;z-index:5;display:flex;gap:1rem;align-items:center;padding:.6rem 1rem;background:var(--bg);border-bottom:1px solid var(--line)}
header .brand{font-weight:700;text-decoration:none;color:var(--fg)}header .brand span{color:var(--accent)}
#q{margin-left:auto;min-width:0;width:16rem;max-width:50vw;padding:.4rem .6rem;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg)}
#results{position:absolute;right:1rem;top:3.4rem;width:20rem;max-width:calc(100vw - 2rem);background:var(--side);border:1px solid var(--line);border-radius:8px;list-style:none;margin:0;padding:.25rem;display:none}
#results a{display:block;padding:.4rem .6rem;text-decoration:none;color:var(--fg)}#results a:hover{background:var(--line)}
.layout{display:grid;grid-template-columns:16rem minmax(0,1fr);max-width:72rem;margin:0 auto}
nav.side{padding:1.25rem 1rem;border-right:1px solid var(--line);background:var(--side);min-height:calc(100vh - 3.2rem)}
nav.side h2{font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:1.2rem 0 .3rem}
nav.side ul{list-style:none;margin:0;padding:0}nav.side a{display:block;padding:.2rem .5rem;border-radius:6px;text-decoration:none;color:var(--fg)}
nav.side a[aria-current=page]{background:var(--line);font-weight:600}
main{padding:2rem 1.5rem 4rem;min-width:0}main h1{margin-top:0}
main h2{margin-top:2.2rem;border-bottom:1px solid var(--line);padding-bottom:.3rem}
.anchor{opacity:0;text-decoration:none;font-size:.8em}h2:hover .anchor,h3:hover .anchor,.anchor:focus{opacity:1}
pre{background:var(--code);color:var(--codefg);padding:1rem;border-radius:8px;overflow:auto;font-size:.875rem;line-height:1.5}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.9em}
:not(pre)>code{background:var(--line);padding:.1em .35em;border-radius:4px}
table{border-collapse:collapse;display:block;overflow:auto;max-width:100%}th,td{border:1px solid var(--line);padding:.4rem .7rem;text-align:left;vertical-align:top}
blockquote{margin:1rem 0;padding:.5rem 1rem;border-left:4px solid var(--accent);background:var(--side)}
.pager{display:flex;justify-content:space-between;gap:1rem;margin-top:3rem;border-top:1px solid var(--line);padding-top:1rem}
footer{max-width:72rem;margin:0 auto;padding:1rem 1.5rem 2rem;color:var(--muted);font-size:.85rem}
@media (max-width:760px){.layout{grid-template-columns:1fr}nav.side{border-right:0;border-bottom:1px solid var(--line);min-height:0}}
@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}
`;

const sideNav = (current) =>
  nav
    .map(
      (s) =>
        `<h2>${esc(s.section)}</h2><ul>${s.pages.map((n) => `<li><a href="${n}.html"${n === current ? ' aria-current="page"' : ""}>${esc(pages.find((p) => p.name === n).title)}</a></li>`).join("")}</ul>`,
    )
    .join("");

const script = `
fetch("search.json").then(r=>r.json()).then(idx=>{
  const q=document.getElementById("q"),res=document.getElementById("results");
  q.addEventListener("input",()=>{
    const t=q.value.trim().toLowerCase();res.replaceChildren();
    if(t.length<2){res.style.display="none";return}
    const hits=idx.filter(p=>p.text.includes(t)||p.title.toLowerCase().includes(t)).slice(0,8);
    for(const h of hits){const li=document.createElement("li"),a=document.createElement("a");a.href=h.url;a.textContent=h.title;li.append(a);res.append(li)}
    res.style.display=hits.length?"block":"none";
  });
  document.addEventListener("keydown",e=>{if(e.key==="Escape")res.style.display="none"});
}).catch(()=>{});
`;

const render = (p, i) => {
  const prev = pages[i - 1],
    next = pages[i + 1];
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)} · Rhea.js docs</title>
<meta name="description" content="Rhea.js documentation: ${esc(p.title)}">
<style>${css}</style></head>
<body><a class="skip" href="#content">Skip to content</a>
<header><a class="brand" href="introduction.html">Rhea<span>.js</span></a>
<input id="q" type="search" placeholder="Search docs" aria-label="Search docs" autocomplete="off"><ul id="results" aria-label="Search results"></ul></header>
<div class="layout"><nav class="side" aria-label="Documentation">${sideNav(p.name)}</nav>
<main id="content">${marked.parse(p.md)}
<div class="pager">${prev ? `<a href="${prev.name}.html" rel="prev">← ${esc(prev.title)}</a>` : "<span></span>"}${next ? `<a href="${next.name}.html" rel="next">${esc(next.title)} →</a>` : "<span></span>"}</div></main></div>
<footer>Rhea.js is alpha software. Made by Shams Ali Shaikh. MIT licensed.</footer>
<script>${script}</script></body></html>`;
};

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
pages.forEach((p, i) => writeFileSync(join(out, `${p.name}.html`), render(p, i)));
writeFileSync(
  join(out, "index.html"),
  `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=introduction.html"><link rel="canonical" href="introduction.html"><a href="introduction.html">Rhea.js docs</a>`,
);
writeFileSync(
  join(out, "search.json"),
  JSON.stringify(
    pages.map((p) => ({
      title: p.title,
      url: `${p.name}.html`,
      text: p.md
        .toLowerCase()
        .replace(/```[\s\S]*?```/g, " ")
        .slice(0, 6000),
    })),
  ),
);
console.log(`Built ${pages.length} pages to apps/docs/dist`);

import { site } from "../site";
import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";
import { ThemeToggle } from "./ThemeToggle";

const links: [string, string][] = [
  ["/#why", "Why"],
  ["/#stack", "Stack"],
  ["/#cli", "CLI"],
  ["/#security", "Security"],
  ["/#roadmap", "Roadmap"],
];

export function Header() {
  return (
    <>
      <a href="#main" className="absolute -left-[999px] focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-bg">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 md:px-6">
          <a href="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
            <Logo />
            {site.name}
          </a>
          <nav aria-label="Primary" className="ml-auto hidden items-center gap-6 text-sm text-slate md:flex">
            {links.map(([href, label]) => (
              <a key={href} href={href} className="hover:text-ink">
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-5">
            {site.repoUrl && (
              <a href={site.repoUrl} className="hidden rounded-lg px-2.5 py-1.5 text-sm text-slate hover:text-ink sm:block">
                GitHub
              </a>
            )}
            <a href="/docs/introduction/" className="rounded-lg bg-ink px-3.5 py-1.5 text-sm font-semibold text-bg hover:opacity-90">
              Docs
            </a>
            <ThemeToggle />
            <MobileMenu>
              <summary
                aria-label="Menu"
                className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-lg border border-line bg-panel marker:hidden [&::-webkit-details-marker]:hidden"
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                  <path d="M3 6h14M3 10h14M3 14h14" className="group-open:hidden" />
                  <path d="M5 5l10 10M15 5L5 15" className="hidden group-open:block" />
                </svg>
              </summary>
              <nav aria-label="Mobile" className="absolute right-0 mt-2 w-56 rounded-xl border border-line bg-panel p-2 shadow-lg">
                {links.map(([href, label]) => (
                  <a key={href} href={href} className="block rounded-lg px-3 py-2.5 hover:bg-bg">
                    {label}
                  </a>
                ))}
                {site.repoUrl && (
                  <a href={site.repoUrl} className="block rounded-lg px-3 py-2.5 hover:bg-bg">
                    GitHub
                  </a>
                )}
              </nav>
            </MobileMenu>
          </div>
        </div>
      </header>
    </>
  );
}

export function Footer() {
  const col = "space-y-2 text-sm text-slate [&_a:hover]:text-ink";
  const h = "mb-3 text-sm font-semibold text-ink";
  return (
    <footer className="border-t border-line bg-panel">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-6">
        <div>
          <a href="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
            <Logo />
            {site.name}
          </a>
          <p className="mt-3 max-w-xs text-sm text-slate">
            Secure, convention-driven backend framework for Node.js. Made by {site.author}. MIT licensed. Alpha {site.version}.
          </p>
        </div>
        <div>
          <p className={h}>Learn</p>
          <ul className={col}>
            <li>
              <a href="/docs/quick-start/">Quick start</a>
            </li>
            <li>
              <a href="/docs/introduction/">Documentation</a>
            </li>
            <li>
              <a href="/docs/cli/">CLI reference</a>
            </li>
            <li>
              <a href="/docs/security/">Security guide</a>
            </li>
          </ul>
        </div>
        <div>
          <p className={h}>Project</p>
          <ul className={col}>
            {site.repoUrl && (
              <li>
                <a href={site.repoUrl}>GitHub</a>
              </li>
            )}
            {site.npmUrl && (
              <li>
                <a href={site.npmUrl}>npm</a>
              </li>
            )}
            {site.repoUrl && (
              <li>
                <a href={`${site.repoUrl}/discussions`}>Discussions</a>
              </li>
            )}
            <li>
              <a href="/#roadmap">Roadmap</a>
            </li>
          </ul>
        </div>
        <div>
          <p className={h}>Legal</p>
          <ul className={col}>
            <li>
              <a href="/privacy/">Privacy policy</a>
            </li>
            {site.repoUrl && (
              <li>
                <a href={`${site.repoUrl}/blob/main/SECURITY.md`}>Report a vulnerability</a>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-slate md:px-6">
          No cookies, no analytics, no third-party requests. © {new Date().getFullYear()} {site.author}.
        </p>
      </div>
    </footer>
  );
}

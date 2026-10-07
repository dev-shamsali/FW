import { site } from "../site";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <>
      <a
        href="#main"
        className="absolute -left-[999px] focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-gold focus:px-3 focus:py-2 focus:text-[#0d1b2a]"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-5 px-4 py-2.5 md:px-6">
          <a href="/" className="text-lg font-semibold tracking-tight">
            {site.name}
          </a>
          <nav aria-label="Primary" className="ml-auto flex items-center gap-4 text-sm text-slate">
            <a href="/#why" className="hidden hover:text-ink sm:inline">
              Why
            </a>
            <a href="/#cli" className="hidden hover:text-ink sm:inline">
              CLI
            </a>
            <a href="/#security" className="hidden hover:text-ink sm:inline">
              Security
            </a>
            <a href="/#roadmap" className="hidden hover:text-ink sm:inline">
              Roadmap
            </a>
            <a href="/docs/introduction/" className="font-medium text-ink">
              Docs
            </a>
            <ThemeToggle />
          </nav>
        </div>
      </header>
    </>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2 px-4 py-8 text-sm text-slate md:px-6">
        <span>
          {site.name} {site.version}. Made by {site.author}. MIT licensed. Alpha software.
        </span>
        <a href="/docs/introduction/" className="underline decoration-line underline-offset-4 hover:text-ink">
          Docs
        </a>
        <a href="/privacy/" className="underline decoration-line underline-offset-4 hover:text-ink">
          Privacy policy
        </a>
      </div>
    </footer>
  );
}

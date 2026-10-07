import type { Metadata } from "next";
import { Footer, Header } from "../../components/SiteChrome";
import { site } from "../../site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `How ${site.name} handles data: this website and the ${site.name} packages.`,
  alternates: { canonical: "/privacy/" },
};

const UPDATED = "2026-10-07";

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-10 border-t border-line pt-6 text-2xl font-semibold tracking-tight">
      {children}
    </h2>
  );
}

export default function Privacy() {
  return (
    <>
      <Header />
      <main id="main" className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:px-6 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <article className="max-w-3xl [&_a]:underline [&_a]:decoration-gold [&_a]:decoration-2 [&_a]:underline-offset-4 [&_li]:my-1 [&_p]:my-3 [&_p]:text-[1.0625rem] [&_p]:leading-[1.7] [&_ul]:list-disc [&_ul]:pl-6">
          <h1 className="text-4xl font-semibold tracking-tight">Privacy policy</h1>
          <p className="text-slate">Last updated {UPDATED}</p>
          <p className="text-lg">
            This policy covers the {site.name} website at {site.siteUrl.replace(/^https?:\/\//, "")} and the {site.name} software packages. It describes what
            actually happens today, in plain language.
          </p>

          <H id="summary">Summary</H>
          <ul>
            <li>The website does not use cookies, analytics, advertising or tracking scripts.</li>
            <li>The website does not load fonts, scripts or images from third-party servers.</li>
            <li>The {site.name} packages and CLI do not send telemetry or usage data anywhere.</li>
            <li>We do not ask for, collect or sell personal information through the website.</li>
          </ul>

          <H id="website">The website</H>
          <p>
            The website is a static site. Pages are plain files served to your browser. There are no accounts, forms, comments or logins, so there is nothing
            for you to submit. Fonts are bundled with the site and served from the same origin.
          </p>
          <p>
            <strong>Server logs.</strong> Like any web server, the server that hosts this site can record technical details of each request, such as your IP
            address, the page requested, the time, and your browser&apos;s user agent. These logs exist for operating and securing the site. How long they are kept
            depends on the hosting server&apos;s configuration.
          </p>
          <p>
            <strong>Stored in your browser.</strong> If you choose a light or dark theme, your choice is saved in your browser&apos;s local storage under the
            key <code>rhea-theme</code>. It never leaves your device and you can clear it at any time in your browser settings. Documentation search runs
            entirely in your browser against a file downloaded with the docs.
          </p>
          <p>
            <strong>Links.</strong> If you follow a link to another website, that website&apos;s own policy applies.
          </p>

          <H id="software">The {site.name} software</H>
          <p>
            {site.name} is open-source software that runs on your own machines. The framework and the <code>rhea</code> CLI do not collect telemetry and do not
            contact any server of ours. Your application&apos;s data stays in your application.
          </p>
          <p>
            Some commands use the network because you ask them to: <code>npm install</code> contacts the npm registry, and <code>rhea security --audit</code>{" "}
            runs <code>npm audit</code>, which sends your dependency list to the npm registry. Those requests are governed by npm&apos;s policies, not ours.
          </p>
          <p>
            Applications you build with {site.name} may collect personal data. You are responsible for how your application does that. The framework&apos;s
            logger redacts a default list of sensitive fields, but redaction is not a substitute for deciding what you log.
          </p>

          <H id="children">Children</H>
          <p>The site is aimed at software developers and is not directed at children. It does not knowingly collect personal information from anyone.</p>

          <H id="changes">Changes to this policy</H>
          <p>If the site or software starts handling data differently, this page will be updated before the change ships, and the date above will change.</p>

          <H id="contact">Contact</H>
          <p>
            {site.contactEmail ? (
              <>
                Questions about this policy: <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
              </>
            ) : (
              <>
                A contact address has not been published yet. Until it is, please raise questions through the project&apos;s issue tracker once the repository
                is public.
              </>
            )}
          </p>
          <p className="text-sm text-slate">Operator: {site.author}.</p>
        </article>

        <nav aria-label="On this page" className="hidden text-sm lg:block">
          <div className="sticky top-20">
            <p className="mb-2 font-semibold">On this page</p>
            <ul className="space-y-1.5 border-l border-line pl-3 text-slate">
              {[
                ["summary", "Summary"],
                ["website", "The website"],
                ["software", "The software"],
                ["children", "Children"],
                ["changes", "Changes"],
                ["contact", "Contact"],
              ].map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="hover:text-ink">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </main>
      <Footer />
    </>
  );
}

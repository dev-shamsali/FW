# Security policy

## Supported versions

Rhea.js is alpha software. Only the latest published `0.x` release receives security fixes.

| Version                | Supported |
| ---------------------- | --------- |
| latest `0.1.0-alpha.x` | Yes       |
| older                  | No        |

## Reporting a vulnerability

**Do not open a public issue, pull request or discussion for a vulnerability.**

Report it privately using GitHub's private vulnerability reporting: open the repository's **Security** tab and choose **Report a vulnerability**. If that option is not available, open a public issue that says only "I have a security report" and contains no technical details, and the maintainer will arrange a private channel.

Please include:

- the affected package and version (`rhea info` prints them),
- a description of the issue and its impact,
- steps or a minimal project that reproduces it,
- your Node.js version and operating system,
- whether you want to be credited.

Please do not include real secrets, credentials or personal data.

## What to expect

This is a single-maintainer open-source project. The maintainer aims to acknowledge reports within 7 days and to agree a fix and disclosure timeline with you. No bug bounty is offered. Please give the maintainer reasonable time to ship a fix before disclosing publicly.

## Scope

In scope: the code in this repository (`@rheajs/core`, `@rheajs/cli`, `create-rhea`, generated project templates, the website and docs build).

Out of scope: vulnerabilities in third-party dependencies that have no Rhea.js-specific impact (report those upstream), applications built with Rhea.js, and denial of service through unrealistic resource use.

## What Rhea.js does not claim

`rhea security` is a static check, not a penetration test or audit. Security defaults reduce common mistakes and do not guarantee a secure application.

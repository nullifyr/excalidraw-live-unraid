# Changes

## 1.0.2

Updates upstream to 2.2.0, commit `81720ac819d2325177cd6137c6ad41d52d0f5374`, which restricts MCP file tools
to resolved, allowed paths and file types, fixes idle autosync, element links and
dark theme, and adds the `get_selection` tool. Raises `@modelcontextprotocol/server`
and `@modelcontextprotocol/core` to 2.4.0 and `zod` to 4.6.7 to fix advisories
GHSA-jm63-cq47-j5jp, GHSA-46jr-4wx8-v453, GHSA-rvq5-wwqv-78pq, GHSA-f897-62hf-6gxq and
GHSA-mrhx-c7xc-m3w5, and refreshes the lockfile for the body-parser, express, qs and
vite fixes. Patches one upstream line at build time for zod 4. Refreshes the
Node 24 base image. Complete-lockfile npm audit reports zero advisories.

## 1.0.1

Pins compatible security fixes across server, bundled frontend and build-tool
dependencies. Both complete-lockfile and runtime npm audits pass with zero
advisories at release time. Adds real MCP-to-browser Mermaid conversion to the
live acceptance test. Keeps application source pinned and unchanged at upstream
2.1.2, commit `8084a1c8b410d625fcfd59d5cffb32f3a86a2a6f`.

## 1.0.0

Initial Docker/Unraid package with persistent appdata, loopback access, stdio MCP,
non-root hardened runtime, attribution, support documentation and release build.
Superseded by 1.0.1, which also covers dependencies compiled into the frontend.

# Acceptance tests

`python3 tests/validate-template.py` checks the public installation contract.
`node --test tests/mcp-client.test.mjs` checks the acceptance-test MCP client
with local synthetic child processes; it does not contact Docker or a canvas.
Both checks run on pull requests and main-branch pushes without publishing an
image.
The image build runs upstream's stdio, loopback binding, rendering, scene
integrity and durability tests, plus both TypeScript checks.

The live test edits **an empty dedicated test canvas**. It uses a real browser
and real MCP over `docker exec -i`, verifies the browser scene after live
create/update/delete messages, and restarts Docker to compare the full scene,
binary file and snapshot responses. It also exercises Mermaid conversion in the
real frontend after the dependency patches. Use synthetic content only. It creates
local screenshots and `evidence/acceptance.json`; these are ignored by Git.

Install `cloakbrowser` and `playwright-core` in your test environment. With an
existing SSH tunnel to a dedicated remote test instance:

```sh
ACCEPTANCE_TEST_CANVAS=1 SSH_HOST=your-unraid-ssh-host \
CANVAS_URL=http://127.0.0.1:3031 TEST_CONTAINER=excalidraw-live \
node tests/live-acceptance.mjs
```

`BROWSER_MODULE` can point to an existing CloakBrowser ES module installation.
The normal package lookup works if installed locally. The test does not create
SSH credentials or register MCP in a user's client configuration.

For a real Unraid install-path test, pass the XML to the **installed** Docker
Manager `xmlToCommand` function and execute its generated create command for
the dedicated new service. Assert it produces one loopback port mapping, the
intended `/data` bind, non-root/read-only settings and correct image. Then run
the live test. Do not simulate installation with a hand-written Docker command
and call that a Docker Manager template test.

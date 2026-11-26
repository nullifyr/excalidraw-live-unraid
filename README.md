# Excalidraw Live for Unraid

A persistent, live agent-editable Excalidraw canvas, packaged from
[yctimlin/mcp_excalidraw](https://github.com/yctimlin/mcp_excalidraw) without
application source changes. Includes the browser canvas, REST/WebSocket server,
headless rendering, CLI and **stdio MCP** runtime in one image.

Upstream: **2.2.0**, commit `81720ac819d2325177cd6137c6ad41d52d0f5374`.
Package: **1.0.2**. Linux amd64; tested on Unraid 7.3.0-rc.2.

## Install on Unraid

Until Community Apps accepts the repository, install the template manually:

1. Download [the template](https://raw.githubusercontent.com/nullifyr/excalidraw-live-unraid/main/templates/excalidraw-live.xml)
   to `/boot/config/plugins/dockerMan/templates-user/my-excalidraw-live.xml`.
2. Docker tab → Add Container → select `excalidraw-live` from user templates.
3. Keep bridge networking, the loopback port binding `127.0.0.1:3031`, and the
   dedicated appdata path `/mnt/user/appdata/excalidraw-live`. Apply.
   Unraid creates the directory as UID 99/GID 100. An existing directory must be
   writable by those IDs. For a new dedicated directory only:
   `install -d -m 0750 -o 99 -g 100 /mnt/user/appdata/excalidraw-live`.
4. From your workstation, forward the port using an existing authorized SSH login:
   `ssh -N -L 127.0.0.1:3031:127.0.0.1:3031 your-unraid-ssh-host`.
5. Open `http://127.0.0.1:3031`. The Unraid WebUI shortcut assumes this workstation
   tunnel and port. If your local port differs, open the matching local URL.

Use the [Compose example](compose.yaml) on other Docker hosts. Create `appdata`
owned by 99:100 before `docker compose up -d`. Do not install a second server
against the same data directory.

## Connect an agent with MCP

Port **3000 inside the container**, mapped to **3031 on server loopback**, serves
the browser, REST API, WebSocket and `/health`. It is **not an HTTP MCP endpoint**.
MCP uses JSON-RPC over stdin/stdout. Start one MCP process per client connection;
all connect to the running canvas inside the container.

Example for a client accepting `mcpServers` configuration:

```json
{
  "mcpServers": {
    "excalidraw": {
      "command": "ssh",
      "args": ["-T", "-o", "BatchMode=yes", "your-unraid-ssh-host", "docker", "exec", "-i", "excalidraw-live", "excalidraw-mcp"]
    }
  }
}
```

For Codex CLI, register the equivalent stdio command:

```sh
codex mcp add excalidraw -- ssh -T -o BatchMode=yes your-unraid-ssh-host docker exec -i excalidraw-live excalidraw-mcp
```

Use your existing SSH access and verified host key. Do not allocate a TTY (`-t`)
to MCP. Test with `tools/list` and `query_elements` before editing. The browser
tunnel is independent of this SSH stdio connection. A client requiring remote
HTTP MCP needs a separately authenticated bridge; none is included here.

## Persistence and upgrades

`EXCALIDRAW_DATA_DIR=/data` enables upstream durable scenes, files and snapshots.
The bind mount stores `canvas-state-v1.json`, content-addressed `blobs/`, and lock
artifacts. A successful mutation checkpoints state before it is acknowledged.
The server uses atomic replacement and fsync, protects one data-directory owner,
and refuses corrupt state rather than silently starting empty.

Only `/data` is persistent. The root filesystem is read-only; logs, PID files
and other temporary state live in a 64 MiB `/tmp` mount. Logs are temporary and
Docker log rotation is capped. Container restart policy is `unless-stopped`;
Unraid autostart can be enabled in its UI. SIGTERM has a 10-second grace period.
No machine reboot has been simulated by this package's acceptance test.

Before an upgrade, stop the container and back up **the complete appdata
directory**, including blobs. Record the current image digest. Pull the next
versioned image and change the template repository tag; retain the same `/data`
mapping. Start, check health and reopen the scene. If an upgrade changes the data
format, rollback requires both the previous image and the stopped backup. Do not
delete an ownership lock while a server may still be running. See
[support](docs/SUPPORT.md) for recovery.

## Access and shared editing

There is **no built-in authentication** on REST or WebSocket. Anyone reaching
the port can read, edit, export or erase the shared scene. Keep the default
loopback binding and SSH tunnel. Exposing it to a LAN, public interface, reverse
proxy or tunnel requires your own explicitly chosen access policy. Do not forward
this service to the Internet without authentication covering both HTTP and WS.
The container publishes no other port and mounts neither Docker's socket nor
host credentials. It runs as UID 99/GID 100 with capabilities dropped and
`no-new-privileges`; the MCP command still requires a host account authorized to
run Docker. Docker access is privileged host access, so use an existing trusted
account and avoid issuing a new unrestricted login just for this app.

There is **one shared scene per canvas server**. Browser sync replaces the
entire scene; this is not conflict-safe concurrent collaboration. Coordinate
browser and agent writes. For separate canvases, install separate instances with
different container names, host ports and data directories. Browser theme/library
preferences may remain browser-local; scene persistence is server-side.

The optional `share`/`export_to_excalidraw` tool uploads encrypted scene data to
Excalidraw's public sharing service. Only invoke it when you intend that export.

## Build and maintenance

```sh
git clone --recurse-submodules https://github.com/nullifyr/excalidraw-live-unraid.git
cd excalidraw-live-unraid
python3 tests/validate-template.py
docker build -t excalidraw-live:dev .
```

The Git submodule pins upstream code. `build/package*.json` retains the upstream
manifest with exact packaging overrides for `proxy-addr` 2.0.8 and `qs` 6.16.0,
fixing [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h)
and the [qs advisories](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g).
Additional compatible frontend and build-tool patches are pinned in
[`build/package.json`](build/package.json), covering dependencies compiled into
the browser bundle as well as server dependencies. The full build lockfile and
production dependency audits both report zero advisories at the 1.0.2 release
build. Application source is unchanged except one line patched at build time for zod 4 (see the Dockerfile). Refresh this overlay from the reviewed upstream
manifest when updating; regenerate its lock with `npm install --package-lock-only
--ignore-scripts --prefix build`. Full and runtime dependency audits are build gates.
The Node base image is pinned by multi-platform manifest digest; builds use `npm ci`. Build checks run
backend/frontend type checks and upstream MCP, bind, rendering, state integrity
and durability tests. [Release workflow](.github/workflows/release.yml) publishes
version and immutable commit tags. `latest` follows released versions; the
template uses a version tag for deliberate upgrades.

To update upstream, review its license/security/data-format changes, advance the
submodule to an exact tested commit, update the OCI upstream label and this
document, refresh the base digest as needed, run all checks and perform the
[live acceptance test](tests/README.md). Publish a new package version, then
update the template and run Community Apps Validate and Scan.

## Attribution and support

Application by **yctimlin and contributors**, MIT, retained unchanged as a pinned
submodule. Packaging by **nullifyr**, MIT. Excalidraw is MIT; bundled fonts are
SIL OFL 1.1. Original notices ship in `/licenses` and `assets/fonts/LICENSES.md`.
This is an independent package, not an official Excalidraw or Unraid product.
The original icon in this repository is MIT licensed.

[Report packaging issues](https://github.com/nullifyr/excalidraw-live-unraid/issues).
Include package tag/digest, Unraid version and redacted error text; do not upload
your scene, credentials, network configuration or an unrestricted Docker inspect.
For application bugs, reproduce on the pinned upstream and link the relevant
[upstream issue](https://github.com/yctimlin/mcp_excalidraw/issues).

Repository/image publication does not mean Community Apps acceptance. See
[submission instructions](docs/COMMUNITY-APPS.md).

# OpenAPI Import

HarborClient plugin that imports an OpenAPI 3.x specification and creates a collection with requests grouped by the first tag on each operation.

![Screenshot](screenshot.png)


## Features

- **File → Import OpenAPI** menu action
- Local JSON/YAML parsing after `fs.pickFile` — nothing is uploaded
- Preview operations grouped by tag before import
- Bulk collection creation via `hc.host.createCollection`

## Permissions

- `ui` — main view, File menu item, and host collection command
- `filesystem:pick` / `filesystem:read` — choose and read the spec file locally
- `storage` — remember the last picked spec path

## Setup

```bash
pnpm install
pnpm build
```

Load the project folder in HarborClient via **Settings → Plugins → Load unpacked…**.

Requires `@harborclient/sdk@^0.4.3`.

## Local SDK development

Do not commit `file:` paths in `package.json`. To test against a local `@harborclient/sdk` checkout without changing tracked files, use one of:

- `pnpm link` from the published package directory after `pnpm pack` in `harborclient/sdk`
- A gitignored override file that only exists on your machine

## Development

```bash
pnpm dev
```

Rebuilds `dist/renderer.js` on change. Keep the Import OpenAPI main view open for hot reload.

## Usage

1. Choose **File → Import OpenAPI**.
2. Pick a `.json`, `.yaml`, or `.yml` OpenAPI 3.x file.
3. Review the generated operations, adjust the collection name, and deselect any endpoints you do not need.
4. Click **Import collection**.

Requests are grouped into folders using each operation's first OpenAPI tag. Untagged operations are created at the collection root.

## Limitations (v1)

- OpenAPI 3.x only
- No `$ref` resolution beyond inline schemas on request bodies
- Request bodies are inferred from JSON examples or simple object schemas only

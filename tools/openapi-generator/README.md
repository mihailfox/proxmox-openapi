# OpenAPI generator

The OpenAPI generator transforms the normalized Proxmox VE API intermediate
representation (IR) into an OpenAPI 3.1 specification. It consumes the IR JSON
produced by the normalizer and emits deterministic JSON and YAML documents in
`var/openapi/` (ignored by git).

## Usage

1. Ensure the IR snapshot exists (regenerate with `npm run normalizer:generate`
   if required).
2. Generate the OpenAPI document:

   ```bash
   npm run openapi:generate
   ```

   Use `-- --input <path>` or `-- --output <dir>` to override paths. Combine with
   `-- --basename <name>` to change the filename prefix or `-- --format json,yaml`
   to restrict the generated artifacts.
3. Validate the generated specification:

   ```bash
   npm run openapi:validate
   ```

## Testing

Run the Vitest suite to validate the transformation logic:

```bash
npm run openapi:test
```

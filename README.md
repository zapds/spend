# spend

Personal spending tools organized as two projects:

- `cli/` - Rust command-line app for recording, querying, importing, exporting, and summarizing spend data in PostgreSQL.
- `dashboard/` - Next.js dashboard for visualizing, reviewing, and managing spend data.

## CLI

```bash
cd cli
cargo build --release
./target/release/spend --help
```

Install the CLI to your user bin directory:

```bash
./cli/setup.sh
```

The CLI reads database config from:

```text
~/.config/spend/config.json
```

Expected shape:

```json
{ "database_url": "postgres://user:pass@localhost/spend" }
```

Create the database schema from the CLI project:

```bash
psql "$DATABASE_URL" < cli/schema.sql
```

See `cli/README.md` for CLI usage.

## Dashboard

```bash
cd dashboard
npm run dev
```

The dashboard is initialized with Next.js, TypeScript, App Router, Tailwind, and ESLint. It is currently a scaffold ready for spend visualizations.
The dashboard connects directly to PostgreSQL from server-side route handlers and provides password-gated analytics, transaction review, spend entry, and payee default management.

Create dashboard environment config from the example:

```bash
cp dashboard/.env.example dashboard/.env.local
```

Expected values:

```text
DATABASE_URL=postgres://user:password@host:5432/spend
DASHBOARD_PASSWORD=change-me
```

## Repository Layout

```text
spend/
  cli/
    Cargo.toml
    src/
    schema.sql
  dashboard/
    package.json
    src/
  README.md
```

# spend CLI

Agent-friendly CLI for recording and querying personal spending against PostgreSQL.

## Features

- **add** – Record a spend with amount, payee, optional tag, optional note/timestamp
- **list** – Filter by tag, payee, date range, amount range; sort any column; output as table, JSON, or CSV
- **get** – Fetch a single spend by id
- **update** – Modify fields or replace tags on an existing spend
- **remove** – Delete a spend by id
- **summary** – Aggregate totals grouped by day, week, month, year, tag, or payee
- **export/import** – Bulk CSV or JSON transfer; missing tags auto-created on import
- **tags** – CRUD for tag names (renaming, removing with referential integrity)
- **payees** – Store exact payee names with one required default tag for future spends
- **validate-tags** – Check whether planned tag names exist before scripting an add

## Prerequisites

- Rust (edition 2024)
- PostgreSQL 12+

## Setup

1. **Configure the database URL**

   ```json
   // ~/.config/spend/config.json
   { "database_url": "postgres://user:pass@localhost/spend" }
   ```

2. **Create the database and schema**

   ```bash
   createdb spend
   cd cli
   psql spend < schema.sql
   ```

3. **Build**

   ```bash
   cd cli
   cargo build --release
   ```

4. **Run**

   ```bash
   cd cli
   ./target/release/spend --help
   ```

## Quick start

```bash
# Add a tag
spend tags add --name food
spend tags add --name transport

# Add a known payee default
spend payees add --name Uber --tag transport

# Record a spend
spend add --amount 250 --payee Uber --tag transport
spend add --amount 300 --payee Uber
spend add --amount 1250 --payee "Trader Joe's" --tag food --note 'weekly groceries'

# List spends
spend list --tag food --date-start 2026-06-01 --json

# Summary
spend summary --group-by month

# Export
spend export --format csv > spends.csv

# Import
spend import --file spends.csv
```

## Design

- Uses PostgreSQL `NUMERIC(12,2)` for precise currency storage
- Tags are normalized into a `tags` table
- Each spend has zero or one tag through nullable `spends.tag_id`
- Known payees have exactly one default tag through required `payees.tag_id`
- All data-modifying commands run inside transactions
- Config is read from `~/.config/spend/config.json`
- Agent-friendly: explicit flags, consistent output switches (--json, --csv), no interactive prompts

---
name: spend-cli
description: Use this skill whenever the user asks you to record, query, update, remove, import, export, validate, or summarize personal spending using the local `spend` CLI. Trigger this skill for expense tracking requests, spend logs, reimbursements, budget checks, merchant/payee lookups, tag validation, monthly or tag-based totals, CSV/JSON spend import/export, or any task where the agent should interact with the installed `spend` command instead of inventing its own storage.
---

# Spend CLI

Use the local `spend` command to manage the user's spending database. The CLI is agent-facing: prefer explicit flags, machine-readable output, and small orthogonal commands.

## First checks

Before making changes, verify the CLI is available when needed:

```bash
spend --help
```

If a command fails because config or schema is missing, report the exact error and stop. The CLI reads `~/.config/spend/config.json` and expects a PostgreSQL schema with `tags`, `spends`, and `spend_tags`.

## Core habits

- Use `--json` for read operations when you need to inspect or transform results programmatically.
- Use repeatable `--tag` flags. Do not pass comma-separated tags.
- Use the same filters across `list`, `summary`, and `export`: `--tag`, `--payee`, `--date-start`, `--date-end`, `--amount-min`, `--amount-max`.
- Validate planned tags before `add` or `update` if there is any uncertainty: `spend validate-tags --tag food --tag groceries`.
- Existing tags are required for `add` and `update`. If a user asks to use a new tag, create it first with `spend tags add --name <name>` unless they explicitly asked not to.
- Import creates missing tags automatically, so separate tag creation is not needed before `spend import`.
- Do not ask for confirmation before removal. `spend remove --id <id>` removes immediately.
- Amounts support decimals with up to two places. Normalize spoken amounts like “twelve fifty” into a numeric amount only when the user’s meaning is clear.
- Timestamps should be ISO 8601 with timezone when provided. If the user does not specify a time, omit `--timestamp` so the CLI uses the current local time.

## Recording spends

Required flags are `--amount` and `--payee`.

```bash
spend add --amount 250 --payee Uber --tag transport
spend add --amount 430.50 --payee "Domino's" --tag food --tag friends --note "late dinner"
spend add --amount 1200 --payee Amazon --timestamp "2026-06-24T20:15:00+05:30"
```

Workflow for tagged spends:

1. Run `spend validate-tags` with every planned tag.
2. If unknown tags are reported and the user intended those tags, create them with `spend tags add --name <tag>`.
3. Run `spend add` with repeatable `--tag` flags.

## Reading spends

Retrieve one spend:

```bash
spend get --id 42 --json
```

List spends with composable filters:

```bash
spend list --json
spend list --tag food --json
spend list --tag food --tag groceries --json
spend list --payee Uber --json
spend list --date-start 2026-06-01 --date-end 2026-06-30 --json
spend list --amount-min 500 --sort amount --desc --json
```

For human-facing replies, summarize the relevant fields instead of dumping raw JSON unless the user asked for raw output.

## Updating and removing spends

Update only fields the user asked to change:

```bash
spend update --id 42 --payee "Uber Auto"
spend update --id 42 --clear-tags --tag transport --tag work
spend update --id 42 --note "client visit"
```

If replacing tags, validate/create tags first, then use `--clear-tags` with the new repeatable `--tag` set.

Remove by id:

```bash
spend remove --id 42
```

If the user identifies a spend indirectly, use `spend list --json` filters to find the id before updating or removing. If multiple rows match, ask which one to change.

## Summaries

Use `summary` rather than manually aggregating list output when possible:

```bash
spend summary --group-by month --json
spend summary --group-by tag --date-start 2026-01-01 --json
spend summary --group-by payee --amount-min 100 --json
```

Valid groupings are `day`, `week`, `month`, `year`, `tag`, and `payee`.

## Tags

```bash
spend tags list
spend tags add --name food --description "Meals and groceries"
spend tags remove --name food
spend tags rename --old cab --new transport
spend validate-tags --tag food --tag transport
```

`tags remove` can fail if spends still use the tag. Report that constraint instead of retrying destructively.

## Import and export

Export filtered spends:

```bash
spend export --format json --date-start 2026-01-01
spend export --format csv --tag food
```

Import from files:

```bash
spend import --file spends.json
spend import --file spends.csv --format csv
```

JSON import expects an array of objects with `amount`, `payee`, optional `timestamp`, optional `note`, and `tags`. CSV import requires `amount` and `payee`; optional columns are `timestamp`, `note`, and `tags`, where CSV tags are separated with semicolons.

## Response style

After a successful write, tell the user what changed and include the spend id if the CLI returned one. After a query, answer the user's actual question with totals or matching entries. If a command fails, include the CLI error and the safest next action.

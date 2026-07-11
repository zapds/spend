---
name: spend-cli
description: Use this skill whenever the user asks you to record, query, update, remove, import, export, validate, or summarize personal spending using the local `spend` CLI. Trigger this skill for expense tracking requests, spend logs, reimbursements, budget checks, merchant/payee lookups, known payee default tags, tag validation, monthly or tag-based totals, CSV/JSON spend import/export, or any task where the agent should interact with the installed `spend` command instead of inventing its own storage.
---

# Spend CLI

Use the local `spend` command to manage the user's spending database. The CLI is agent-facing: prefer explicit flags, machine-readable output, and small orthogonal commands.

## First checks

Before making changes, verify the CLI is available when needed:

```bash
spend --help
```

If a command fails because config or schema is missing, report the exact error and stop. The CLI reads `~/.config/spend/config.json` and expects PostgreSQL tables `tags`, `spends`, and `payees`. Each spend has zero or one tag. Each known payee has exactly one default tag.

## Core habits

- Use `--json` for read operations when you need to inspect or transform results programmatically.
- A spend accepts one optional `--tag`, not multiple tags.
- Use the same filters across `list`, `summary`, and `export`: `--tag`, `--payee`, `--date-start`, `--date-end`, `--amount-min`, `--amount-max`.
- Validate planned tags before `add`, `update`, or `payees` changes if there is uncertainty: `spend validate-tags --tag food --tag groceries`.
- Existing tags are required for `add`, `update`, and `payees`. If the user asks to use a new tag, create it first with `spend tags add --name <name>` unless they explicitly asked not to.
- Known payees always have one default tag. `spend add` applies that default only when no explicit `--tag` is passed.
- Explicit `--tag` overrides a known payee default for that spend only. It does not change the known payee rule.
- Untagged spends are allowed when no explicit tag is provided and no known payee default exists.
- Import creates missing tags automatically, but it does not apply known payee defaults.
- Do not ask for confirmation before removal. `spend remove --id <id>` removes immediately.

## Recording spends

Required flags are `--amount` and `--payee`.

```bash
spend add --amount 250 --payee Uber --tag transport
spend add --amount 430.50 --payee "Domino's" --tag food --note "late dinner"
spend add --amount 1200 --payee Amazon --timestamp "2026-06-24T20:15:00+05:30"
```

For a known payee default, omit `--tag`:

```bash
spend payees add --name Uber --tag transport
spend add --amount 250 --payee Uber
```

The spend gets `transport`. If the user passes `--tag work`, the spend gets only `work` and the payee default remains unchanged.

## Reading spends

```bash
spend get --id 42 --json
spend list --json
spend list --tag food --json
spend list --payee Uber --json
spend list --date-start 2026-06-01 --date-end 2026-06-30 --json
spend list --amount-min 500 --sort amount --desc --json
```

For human-facing replies, summarize the relevant fields instead of dumping raw JSON unless the user asked for raw output.

## Updating and removing spends

```bash
spend update --id 42 --payee "Uber Auto"
spend update --id 42 --tag transport
spend update --id 42 --clear-tag
spend update --id 42 --note "client visit"
spend remove --id 42
```

Changing a spend payee does not automatically recalculate its tag from known payee defaults. If the tag should change too, pass `--tag` or `--clear-tag` explicitly.

If the user identifies a spend indirectly, use `spend list --json` filters to find the id before updating or removing. If multiple rows match, ask which one to change.

## Summaries

Use `summary` rather than manually aggregating list output when possible:

```bash
spend summary --group-by month --json
spend summary --group-by tag --date-start 2026-01-01 --json
spend summary --group-by payee --amount-min 100 --json
```

`summary --group-by tag` includes untagged spends as `Untagged`.

## Tags

```bash
spend tags list
spend tags add --name food --description "Meals and groceries"
spend tags remove --name food
spend tags rename --old cab --new transport
spend validate-tags --tag food --tag transport
```

`tags remove` can fail if spends or known payees still use the tag. Report that constraint instead of retrying destructively.

## Known payees

Use known payees when the user wants exact payee names to carry one default tag into future `spend add` commands.

```bash
spend payees list --json
spend payees get --name Uber --json
spend payees add --name Uber --tag transport
spend payees update --name Uber --tag work
spend payees remove --name Uber
spend payees rename --old Uber --new "Uber Auto"
```

Payee names match exactly. `Uber`, `uber`, and `Uber Auto` are different known payees.

## Import and export

```bash
spend export --format json --date-start 2026-01-01
spend export --format csv --tag food
spend import --file spends.json
spend import --file spends.csv --format csv
```

JSON import expects an array of objects with `amount`, `payee`, optional `timestamp`, optional `note`, and optional `tag`. CSV import requires `amount` and `payee`; optional columns are `timestamp`, `note`, and `tag`. Legacy `tags` input is accepted only when empty or containing one tag; multiple tags fail clearly.

## Response style

After a successful write, tell the user what changed and include the spend id if the CLI returned one. After a query, answer the user's actual question with totals or matching entries. If a command fails, include the CLI error and the safest next action.

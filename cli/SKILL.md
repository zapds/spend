---
name: spend-cli
description: Use this skill whenever the user asks you to record, query, update, remove, merge, unmerge, import, export, validate, or summarize personal spending and credits using the local `spend` CLI. Trigger this skill for expense tracking requests, spend logs, credit inflows, reimbursements/splits, budget checks, merchant/payee lookups, known payee default tags, tag validation, monthly or tag-based totals, CSV/JSON/JSONL spend import/export, or any task where the agent should interact with the installed `spend` command instead of inventing its own storage.
---

# Spend CLI

Use the local `spend` command to manage the user's spending and credit database. The CLI is agent-facing: prefer explicit flags, machine-readable output, and small orthogonal commands.

## First checks

Before making changes, verify the CLI is available when needed:

```bash
spend --help
```

If a command fails because config or schema is missing, report the exact error and stop. The CLI reads `~/.config/spend/config.json` and expects PostgreSQL tables `tags`, `spends`, and `payees`. Each transaction has `type` (`debit` or `credit`), zero or one tag, optional `external_ref` (e.g. UPI ref), `dedupe_key`, and `merged_into_id`. Each known payee has exactly one default tag.

## Core habits

- Use `--json` for read operations when you need to inspect or transform results programmatically.
- Transactions have `--type debit` (default, money out) or `--type credit` (money in).
- Duplicate prevention is built in: `spend add` and `spend import` automatically skip duplicates matching `--ref` (external reference, e.g. UPI ref) or `(type, UTC minute, amount, normalized payee)`. Pass `--allow-duplicate` to `spend add` only when intentionally recording an identical manual transaction.
- A transaction accepts one optional `--tag`, not multiple tags.
- Use the same filters across `list`, `summary`, and `export`: `--type`, `--include-merged`, `--tag`, `--payee`, `--date-start`, `--date-end`, `--amount-min`, `--amount-max`.
- Merged credits are hidden by default (`merged_into_id IS NULL`) while staying in the DB to preserve duplicate protection and allow `unmerge`.
- Validate planned tags before `add`, `update`, or `payees` changes if there is uncertainty: `spend validate-tags --tag food --tag groceries`.
- Existing tags are required for `add`, `update`, and `payees`. If the user asks to use a new tag, create it first with `spend tags add --name <name>` unless they explicitly asked not to.
- Known payees always have one default tag. `spend add` and `spend import` apply that default only when no explicit tag is provided.
- Explicit `--tag` overrides a known payee default for that transaction only. It does not change the known payee rule.
- Untagged transactions are allowed when no explicit tag is provided and no known payee default exists.
- Import creates missing tags automatically, applies known payee defaults when no tag is provided, and skips duplicates cleanly.
- Do not ask for confirmation before removal. `spend remove --id <id>` removes immediately.

## Recording debits and credits

Required flags are `--amount` and `--payee`. Amounts accept commas (e.g., `1,250.50`).

```bash
spend add --amount 250 --payee Uber --tag transport
spend add --amount 430.50 --payee "Domino's" --tag food --note "late dinner"
spend add --amount 1200 --payee Amazon --timestamp "2026-06-24T20:15:00+05:30" --ref 632950396958
spend add --type credit --amount 60.00 --payee "AZIZ PRAVIN" --ref 632950396958
```

For a known payee default, omit `--tag`:

```bash
spend payees add --name Uber --tag transport
spend add --amount 250 --payee Uber
```

The transaction gets `transport`. If the user passes `--tag work`, the transaction gets only `work` and the payee default remains unchanged.

## Merging credits into debits (reimbursements / splits)

When a friend pays the user back (recorded as a `credit`) for an expense the user paid (a `debit`), merge the credit into the debit so the debit amount is reduced to the user's net share:

```bash
spend merge --credit 45 --into 42
```

This atomically:
1. Reduces debit `42`'s amount by credit `45`'s amount (fails if credit > debit).
2. Appends a merge note (`Merged credit #45 (₹... from ...)`) to debit `42`.
3. Marks credit `45` with `merged_into_id = 42` so it is hidden from active lists/summaries while keeping its `external_ref`/`dedupe_key` intact against Syncthing replays.

To undo a merge:

```bash
spend unmerge --credit 45
```

## Reading transactions

```bash
spend get --id 42 --json
spend list --json
spend list --type credit --json
spend list --type debit --tag food --json
spend list --include-merged --json
spend list --payee Uber --json
spend list --date-start 2026-06-01 --date-end 2026-06-30 --json
spend list --amount-min 500 --sort amount --desc --json
```

For human-facing replies, summarize the relevant fields instead of dumping raw JSON unless the user asked for raw output.

## Updating and removing transactions

```bash
spend update --id 42 --payee "Uber Auto"
spend update --id 42 --type credit
spend update --id 42 --tag transport
spend update --id 42 --clear-tag
spend update --id 42 --note "client visit"
spend remove --id 42
```

Changing a payee does not automatically recalculate its tag from known payee defaults. If the tag should change too, pass `--tag` or `--clear-tag` explicitly.

If the user identifies a transaction indirectly, use `spend list --json` filters to find the id before updating, merging, or removing. If multiple rows match, ask which one to change.

## Summaries

Use `summary` rather than manually aggregating list output when possible. `summary` defaults to `--type debit` (active spending after merges); pass `--type credit` to summarize unmerged credits:

```bash
spend summary --group-by month --json
spend summary --type credit --group-by payee --json
spend summary --group-by tag --date-start 2026-01-01 --json
spend summary --group-by payee --amount-min 100 --json
```

`summary --group-by tag` includes untagged transactions as `Untagged`.

## Tags

```bash
spend tags list
spend tags add --name food --description "Meals and groceries"
spend tags remove --name food
spend tags rename --old cab --new transport
spend validate-tags --tag food --tag transport
```

`tags remove` can fail if transactions or known payees still use the tag. Report that constraint instead of retrying destructively.

## Known payees

Use known payees when the user wants exact payee names to carry one default tag into future `spend add` / `spend import` commands.

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
spend export --format jsonl
spend import --file ~/life/pending_spends.jsonl
spend import --file spends.json
spend import --file spends.csv --format csv
```

- **JSONL** (`.jsonl`): one JSON object per line with `amount` (number or string, commas allowed), `payee`, optional `type` (`debit` or `credit`, defaults to `debit`), `timestamp`, `note`, `tag`, and `ref` (or `external_ref`).
- **JSON** (`.json`): array of objects with the same fields.
- **CSV** (`.csv`): requires `amount` and `payee`; optional columns are `type`, `timestamp`, `note`, `tag`, `ref`.
- Duplicates are skipped automatically during import; the CLI reports how many rows were imported and skipped.

## Response style

After a successful write, tell the user what changed and include the transaction id if the CLI returned one. After a query, answer the user's actual question with totals or matching entries. If a command fails, include the CLI error and the safest next action.

use std::env;
use std::error::Error;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::str::FromStr;

use chrono::{DateTime, Local, NaiveDate, Utc};
use clap::{Args, Parser, Subcommand, ValueEnum};
use postgres::types::ToSql;
use postgres::{Client, NoTls, Row};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

type AnyError = Box<dyn Error>;

const HELP_TEMPLATE: &str =
    "{before-help}{name} {version}\n{about}\n\nUSAGE:\n    {usage}\n\n{all-args}{after-help}";

#[derive(Parser)]
#[command(
    version,
    about = "Agent-friendly CLI for recording and querying spending in PostgreSQL.",
    long_about = "spend is designed for programmatic use by agents. Commands use explicit flags, repeatable --tag filters, and consistent output switches. Database connection settings are read from ~/.config/spend/config.json.",
    help_template = HELP_TEMPLATE,
    after_help = "CONFIG:\n    ~/.config/spend/config.json must contain { \"database_url\": \"postgres://...\" }.\n\nSCHEMA:\n    spend fails if the required PostgreSQL schema is missing. The spends table must include optional note TEXT support.\n\nEXAMPLES:\n    spend add --amount 250 --payee Uber --tag transport\n    spend list --tag food --date-start 2026-06-01 --date-end 2026-06-30 --json\n    spend summary --group-by month\n    spend validate-tags --tag food --tag unknown"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Add one spend. Tags must already exist.
    #[command(
        after_help = "EXAMPLES:\n    spend add --amount 250 --payee Uber --tag transport\n    spend add --amount 430.50 --payee Domino's --tag food --tag friends --note 'late dinner'\n    spend add --amount 1200 --payee Amazon --timestamp 2026-06-24T20:15:00+05:30"
    )]
    Add(AddArgs),

    /// Retrieve one spend by id.
    #[command(after_help = "EXAMPLES:\n    spend get --id 42\n    spend get --id 42 --json")]
    Get(GetArgs),

    /// Remove one spend by id. No confirmation is prompted.
    #[command(after_help = "EXAMPLE:\n    spend remove --id 42")]
    Remove(IdArgs),

    /// Update fields on one spend. Provided tags must already exist.
    #[command(
        after_help = "EXAMPLES:\n    spend update --id 42 --payee 'Uber Auto'\n    spend update --id 42 --clear-tags --tag transport --tag work\n    spend update --id 42 --note 'client visit'"
    )]
    Update(UpdateArgs),

    /// List spends. All filters compose and use the same names as summary/export.
    #[command(
        after_help = "FILTER BEHAVIOR:\n    Repeating --tag means the spend must have every provided tag.\n    Date-only values such as 2026-06-01 are accepted for --date-start and --date-end.\n\nEXAMPLES:\n    spend list --tag food\n    spend list --payee Uber\n    spend list --date-start 2026-06-01 --date-end 2026-06-30\n    spend list --amount-min 500 --sort amount --desc --csv"
    )]
    List(ListArgs),

    /// Aggregate spends. Uses the same filters as list/export.
    #[command(
        after_help = "EXAMPLES:\n    spend summary --group-by month\n    spend summary --group-by tag --date-start 2026-01-01\n    spend summary --group-by payee --amount-min 100"
    )]
    Summary(SummaryArgs),

    /// Manage known tags.
    #[command(subcommand)]
    Tags(TagsCommand),

    /// Export spends as CSV or JSON. Uses the same filters as list/summary.
    #[command(
        after_help = "EXAMPLES:\n    spend export --format csv --tag food\n    spend export --format json --date-start 2026-01-01"
    )]
    Export(ExportArgs),

    /// Import spends from CSV or JSON. Missing tags are created automatically.
    #[command(
        after_help = "INPUT FORMAT:\n    JSON must be an array of objects with amount, payee, optional timestamp, note, and tags.\n    CSV must include amount and payee columns. Optional columns: timestamp,note,tags. Tags in CSV are separated with semicolons.\n\nEXAMPLES:\n    spend import --file spends.json\n    spend import --file spends.csv --format csv"
    )]
    Import(ImportArgs),

    /// Check whether planned tags exist before adding/updating spends.
    #[command(
        name = "validate-tags",
        after_help = "EXAMPLE:\n    spend validate-tags --tag food --tag groceries --tag foo"
    )]
    ValidateTags(TagFilterArgs),
}

#[derive(Subcommand)]
enum TagsCommand {
    /// List known tag names.
    List,
    /// Add one tag.
    Add(TagAddArgs),
    /// Remove one tag by name. Fails if any spend still uses it.
    Remove(TagNameArgs),
    /// Rename one tag.
    Rename(TagRenameArgs),
}

#[derive(Args)]
struct AddArgs {
    /// Decimal amount with up to two places, for example 250 or 250.75.
    #[arg(long)]
    amount: Decimal,
    /// Payee or merchant name.
    #[arg(long)]
    payee: String,
    /// Existing tag to attach. Repeat --tag for multiple tags.
    #[arg(long)]
    tag: Vec<String>,
    /// ISO 8601 timestamp with timezone, for example 2026-06-24T20:15:00+05:30. Defaults to current local time.
    #[arg(long)]
    timestamp: Option<String>,
    /// Optional free-form note.
    #[arg(long)]
    note: Option<String>,
}

#[derive(Args)]
struct GetArgs {
    /// Spend id.
    #[arg(long)]
    id: i64,
    /// Emit machine-readable JSON.
    #[arg(long)]
    json: bool,
}

#[derive(Args)]
struct IdArgs {
    /// Spend id.
    #[arg(long)]
    id: i64,
}

#[derive(Args)]
struct UpdateArgs {
    /// Spend id.
    #[arg(long)]
    id: i64,
    /// Replace the amount. Must have up to two decimal places.
    #[arg(long)]
    amount: Option<Decimal>,
    /// Replace the payee.
    #[arg(long)]
    payee: Option<String>,
    /// Replace the timestamp. Must be ISO 8601 with timezone.
    #[arg(long)]
    timestamp: Option<String>,
    /// Existing tag to attach. Repeat --tag for multiple tags.
    #[arg(long)]
    tag: Vec<String>,
    /// Remove all current tags before applying any provided --tag values.
    #[arg(long)]
    clear_tags: bool,
    /// Replace the note. Use an empty string to clear it.
    #[arg(long)]
    note: Option<String>,
}

#[derive(Args, Clone, Default)]
struct FilterArgs {
    /// Require this existing tag. Repeat --tag to require all provided tags.
    #[arg(long)]
    tag: Vec<String>,
    /// Match exact payee text.
    #[arg(long)]
    payee: Option<String>,
    /// Include spends on/after this date or timestamp. Date example: 2026-06-01.
    #[arg(long)]
    date_start: Option<String>,
    /// Include spends on/before this date or timestamp. Date-only end is inclusive for the whole day.
    #[arg(long)]
    date_end: Option<String>,
    /// Include spends with amount greater than or equal to this value.
    #[arg(long)]
    amount_min: Option<Decimal>,
    /// Include spends with amount less than or equal to this value.
    #[arg(long)]
    amount_max: Option<Decimal>,
}

#[derive(Args)]
struct ListArgs {
    #[command(flatten)]
    filters: FilterArgs,
    /// Maximum rows to return.
    #[arg(long)]
    limit: Option<i64>,
    /// Rows to skip before returning results.
    #[arg(long)]
    offset: Option<i64>,
    /// Sort field.
    #[arg(long, value_enum, default_value_t = SortField::Date)]
    sort: SortField,
    /// Sort descending instead of ascending.
    #[arg(long)]
    desc: bool,
    /// Emit machine-readable JSON.
    #[arg(long)]
    json: bool,
    /// Emit CSV.
    #[arg(long, conflicts_with = "json")]
    csv: bool,
}

#[derive(Args)]
struct SummaryArgs {
    #[command(flatten)]
    filters: FilterArgs,
    /// Grouping dimension for totals.
    #[arg(long, value_enum)]
    group_by: GroupBy,
    /// Emit machine-readable JSON.
    #[arg(long)]
    json: bool,
}

#[derive(Args)]
struct ExportArgs {
    /// Export format.
    #[arg(long, value_enum)]
    format: DataFormat,
    #[command(flatten)]
    filters: FilterArgs,
}

#[derive(Args)]
struct ImportArgs {
    /// CSV or JSON file to import.
    #[arg(long)]
    file: PathBuf,
    /// Input format. If omitted, inferred from file extension.
    #[arg(long, value_enum)]
    format: Option<DataFormat>,
}

#[derive(Args)]
struct TagFilterArgs {
    /// Tag name to validate. Repeat --tag for multiple tags.
    #[arg(long, required = true)]
    tag: Vec<String>,
}

#[derive(Args)]
struct TagAddArgs {
    /// Tag name.
    #[arg(long)]
    name: String,
    /// Optional tag description.
    #[arg(long)]
    description: Option<String>,
}

#[derive(Args)]
struct TagNameArgs {
    /// Tag name.
    #[arg(long)]
    name: String,
}

#[derive(Args)]
struct TagRenameArgs {
    /// Existing tag name.
    #[arg(long)]
    old: String,
    /// New tag name.
    #[arg(long)]
    new: String,
}

#[derive(Clone, Copy, ValueEnum)]
enum SortField {
    Amount,
    Date,
    Payee,
}

#[derive(Clone, Copy, ValueEnum)]
enum GroupBy {
    Day,
    Week,
    Month,
    Year,
    Tag,
    Payee,
}

#[derive(Clone, Copy, ValueEnum)]
enum DataFormat {
    Csv,
    Json,
}

#[derive(Deserialize)]
struct Config {
    database_url: String,
}

#[derive(Serialize)]
struct Spend {
    id: i64,
    timestamp: DateTime<Utc>,
    #[serde(with = "rust_decimal::serde::str")]
    amount: Decimal,
    payee: String,
    note: Option<String>,
    tags: Vec<String>,
}

#[derive(Deserialize)]
struct ImportSpend {
    amount: Decimal,
    payee: String,
    timestamp: Option<String>,
    note: Option<String>,
    #[serde(default)]
    tags: Vec<String>,
}

#[derive(Deserialize)]
struct CsvImportSpend {
    amount: Decimal,
    payee: String,
    timestamp: Option<String>,
    note: Option<String>,
    tags: Option<String>,
}

#[derive(Serialize)]
struct SummaryRow {
    group: String,
    #[serde(with = "rust_decimal::serde::str")]
    total: Decimal,
    count: i64,
}

fn main() {
    if let Err(err) = run() {
        eprintln!("error: {err}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), AnyError> {
    let cli = Cli::parse();
    let config = load_config()?;
    let mut client = Client::connect(&config.database_url, NoTls)?;
    validate_schema(&mut client)?;

    match cli.command {
        Command::Add(args) => add_spend(&mut client, args)?,
        Command::Get(args) => get_spend_cmd(&mut client, args)?,
        Command::Remove(args) => remove_spend(&mut client, args.id)?,
        Command::Update(args) => update_spend(&mut client, args)?,
        Command::List(args) => list_spends_cmd(&mut client, args)?,
        Command::Summary(args) => summary_cmd(&mut client, args)?,
        Command::Tags(command) => tags_cmd(&mut client, command)?,
        Command::Export(args) => export_cmd(&mut client, args)?,
        Command::Import(args) => import_cmd(&mut client, args)?,
        Command::ValidateTags(args) => validate_tags_cmd(&mut client, args.tag)?,
    }

    Ok(())
}

fn load_config() -> Result<Config, AnyError> {
    let home =
        env::var("HOME").map_err(|_| "HOME is not set; cannot find ~/.config/spend/config.json")?;
    let path = Path::new(&home).join(".config/spend/config.json");
    let raw = fs::read_to_string(&path)
        .map_err(|err| format!("failed to read {}: {err}", path.display()))?;
    let config: Config = serde_json::from_str(&raw)
        .map_err(|err| format!("failed to parse {}: {err}", path.display()))?;
    if config.database_url.trim().is_empty() {
        return Err("database_url is required in ~/.config/spend/config.json".into());
    }
    Ok(config)
}

fn validate_schema(client: &mut Client) -> Result<(), AnyError> {
    let required = [
        ("tags", "id"),
        ("tags", "name"),
        ("tags", "description"),
        ("spends", "id"),
        ("spends", "timestamp"),
        ("spends", "amount"),
        ("spends", "payee"),
        ("spends", "note"),
        ("spend_tags", "spend_id"),
        ("spend_tags", "tag_id"),
    ];

    for (table, column) in required {
        let exists: bool = client
            .query_one(
                "SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
            )",
                &[&table, &column],
            )?
            .get(0);
        if !exists {
            return Err(format!("missing required schema column public.{table}.{column}").into());
        }
    }

    Ok(())
}

fn add_spend(client: &mut Client, args: AddArgs) -> Result<(), AnyError> {
    ensure_two_decimal_places(args.amount)?;
    let timestamp = parse_optional_timestamp(args.timestamp.as_deref())?;
    let tag_ids = existing_tag_ids(client, &args.tag, false)?;
    let mut tx = client.transaction()?;
    let row = tx.query_one(
        "INSERT INTO spends (timestamp, amount, payee, note) VALUES ($1, $2::numeric, $3, $4) RETURNING id",
        &[&timestamp, &format_amount(args.amount), &args.payee, &empty_note_to_none(args.note)],
    )?;
    let id: i64 = row.get(0);
    for tag_id in tag_ids.values() {
        tx.execute(
            "INSERT INTO spend_tags (spend_id, tag_id) VALUES ($1, $2)",
            &[&id, tag_id],
        )?;
    }
    tx.commit()?;
    println!("added spend {id}");
    Ok(())
}

fn get_spend_cmd(client: &mut Client, args: GetArgs) -> Result<(), AnyError> {
    let spend =
        get_spend(client, args.id)?.ok_or_else(|| format!("spend {} not found", args.id))?;
    if args.json {
        println!("{}", serde_json::to_string_pretty(&spend)?);
    } else {
        print_spend(&spend);
    }
    Ok(())
}

fn remove_spend(client: &mut Client, id: i64) -> Result<(), AnyError> {
    let changed = client.execute("DELETE FROM spends WHERE id = $1", &[&id])?;
    if changed == 0 {
        return Err(format!("spend {id} not found").into());
    }
    println!("removed spend {id}");
    Ok(())
}

fn update_spend(client: &mut Client, args: UpdateArgs) -> Result<(), AnyError> {
    if let Some(amount) = args.amount {
        ensure_two_decimal_places(amount)?;
    }
    let timestamp = parse_optional_timestamp(args.timestamp.as_deref())?;
    let tag_ids = existing_tag_ids(client, &args.tag, false)?;

    let mut set_parts = Vec::new();
    let mut params: Vec<Box<dyn ToSql + Sync>> = Vec::new();
    if let Some(amount) = args.amount {
        params.push(Box::new(format_amount(amount)));
        set_parts.push(format!("amount = ${}::numeric", params.len()));
    }
    if let Some(payee) = args.payee {
        params.push(Box::new(payee));
        set_parts.push(format!("payee = ${}", params.len()));
    }
    if let Some(timestamp) = timestamp {
        params.push(Box::new(timestamp));
        set_parts.push(format!("timestamp = ${}", params.len()));
    }
    if let Some(note) = args.note {
        params.push(Box::new(empty_note_to_none(Some(note))));
        set_parts.push(format!("note = ${}", params.len()));
    }

    let mut tx = client.transaction()?;
    if !set_parts.is_empty() {
        params.push(Box::new(args.id));
        let query = format!(
            "UPDATE spends SET {} WHERE id = ${}",
            set_parts.join(", "),
            params.len()
        );
        let refs: Vec<&(dyn ToSql + Sync)> = params.iter().map(|p| p.as_ref()).collect();
        let changed = tx.execute(&query, &refs)?;
        if changed == 0 {
            return Err(format!("spend {} not found", args.id).into());
        }
    } else if tx
        .query_opt("SELECT 1 FROM spends WHERE id = $1", &[&args.id])?
        .is_none()
    {
        return Err(format!("spend {} not found", args.id).into());
    }

    if args.clear_tags || !args.tag.is_empty() {
        tx.execute("DELETE FROM spend_tags WHERE spend_id = $1", &[&args.id])?;
        for tag_id in tag_ids.values() {
            tx.execute(
                "INSERT INTO spend_tags (spend_id, tag_id) VALUES ($1, $2)",
                &[&args.id, tag_id],
            )?;
        }
    }
    tx.commit()?;
    println!("updated spend {}", args.id);
    Ok(())
}

fn list_spends_cmd(client: &mut Client, args: ListArgs) -> Result<(), AnyError> {
    validate_filters(&args.filters)?;
    let spends = list_spends(client, &args)?;
    if args.json {
        println!("{}", serde_json::to_string_pretty(&spends)?);
    } else if args.csv {
        write_spends_csv(&spends)?;
    } else {
        print_spends_table(&spends);
    }
    Ok(())
}

fn summary_cmd(client: &mut Client, args: SummaryArgs) -> Result<(), AnyError> {
    validate_filters(&args.filters)?;
    let rows = summary(client, &args)?;
    if args.json {
        println!("{}", serde_json::to_string_pretty(&rows)?);
    } else {
        for row in rows {
            println!(
                "{:<24} {:>12} ({})",
                row.group,
                format_amount(row.total),
                row.count
            );
        }
    }
    Ok(())
}

fn tags_cmd(client: &mut Client, command: TagsCommand) -> Result<(), AnyError> {
    match command {
        TagsCommand::List => {
            for row in client.query("SELECT name FROM tags ORDER BY name", &[])? {
                let name: String = row.get(0);
                println!("{name}");
            }
        }
        TagsCommand::Add(args) => {
            client.execute(
                "INSERT INTO tags (name, description) VALUES ($1, $2)",
                &[&args.name, &args.description],
            )?;
            println!("added tag {}", args.name);
        }
        TagsCommand::Remove(args) => {
            let changed = client.execute("DELETE FROM tags WHERE name = $1", &[&args.name])?;
            if changed == 0 {
                return Err(format!("tag {} not found", args.name).into());
            }
            println!("removed tag {}", args.name);
        }
        TagsCommand::Rename(args) => {
            let changed = client.execute(
                "UPDATE tags SET name = $1 WHERE name = $2",
                &[&args.new, &args.old],
            )?;
            if changed == 0 {
                return Err(format!("tag {} not found", args.old).into());
            }
            println!("renamed tag {} to {}", args.old, args.new);
        }
    }
    Ok(())
}

fn export_cmd(client: &mut Client, args: ExportArgs) -> Result<(), AnyError> {
    validate_filters(&args.filters)?;
    let list_args = ListArgs {
        filters: args.filters,
        limit: None,
        offset: None,
        sort: SortField::Date,
        desc: false,
        json: false,
        csv: false,
    };
    let spends = list_spends(client, &list_args)?;
    match args.format {
        DataFormat::Json => println!("{}", serde_json::to_string_pretty(&spends)?),
        DataFormat::Csv => write_spends_csv(&spends)?,
    }
    Ok(())
}

fn import_cmd(client: &mut Client, args: ImportArgs) -> Result<(), AnyError> {
    let format = args.format.or_else(|| infer_format(&args.file)).ok_or(
        "could not infer import format from file extension; pass --format csv or --format json",
    )?;
    let imports = match format {
        DataFormat::Json => read_json_import(&args.file)?,
        DataFormat::Csv => read_csv_import(&args.file)?,
    };

    let count = imports.len();
    let mut tx = client.transaction()?;
    for item in imports {
        ensure_two_decimal_places(item.amount)?;
        let timestamp = parse_optional_timestamp(item.timestamp.as_deref())?;
        let tag_ids = existing_tag_ids_tx(&mut tx, &item.tags, true)?;
        let row = tx.query_one(
            "INSERT INTO spends (timestamp, amount, payee, note) VALUES ($1, $2::numeric, $3, $4) RETURNING id",
            &[&timestamp, &format_amount(item.amount), &item.payee, &empty_note_to_none(item.note)],
        )?;
        let id: i64 = row.get(0);
        for tag_id in tag_ids.values() {
            tx.execute(
                "INSERT INTO spend_tags (spend_id, tag_id) VALUES ($1, $2)",
                &[&id, tag_id],
            )?;
        }
    }
    tx.commit()?;
    println!("imported {count} spends");
    Ok(())
}

fn validate_tags_cmd(client: &mut Client, tags: Vec<String>) -> Result<(), AnyError> {
    let missing = missing_tags(client, &tags)?;
    if missing.is_empty() {
        println!("All tags are known.");
    } else {
        println!("Unknown tag:");
        for tag in missing {
            println!("- {tag}");
        }
    }
    Ok(())
}

fn list_spends(client: &mut Client, args: &ListArgs) -> Result<Vec<Spend>, AnyError> {
    let mut params: Vec<Box<dyn ToSql + Sync>> = Vec::new();
    let where_clause = build_where_clause(&args.filters, &mut params)?;
    let sort = match args.sort {
        SortField::Amount => "s.amount",
        SortField::Date => "s.timestamp",
        SortField::Payee => "s.payee",
    };
    let direction = if args.desc { "DESC" } else { "ASC" };
    let mut query = format!(
        "SELECT s.id, s.timestamp, s.amount::text, s.payee, s.note,
            COALESCE(array_agg(t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL), ARRAY[]::text[]) AS tags
         FROM spends s
         LEFT JOIN spend_tags st ON st.spend_id = s.id
         LEFT JOIN tags t ON t.id = st.tag_id
         {where_clause}
         GROUP BY s.id
         ORDER BY {sort} {direction}, s.id ASC"
    );

    if let Some(limit) = args.limit {
        params.push(Box::new(limit));
        query.push_str(&format!(" LIMIT ${}", params.len()));
    }
    if let Some(offset) = args.offset {
        params.push(Box::new(offset));
        query.push_str(&format!(" OFFSET ${}", params.len()));
    }

    let refs: Vec<&(dyn ToSql + Sync)> = params.iter().map(|p| p.as_ref()).collect();
    client
        .query(&query, &refs)?
        .into_iter()
        .map(spend_from_row)
        .collect()
}

fn get_spend(client: &mut Client, id: i64) -> Result<Option<Spend>, AnyError> {
    let row = client.query_opt(
        "SELECT s.id, s.timestamp, s.amount::text, s.payee, s.note,
            COALESCE(array_agg(t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL), ARRAY[]::text[]) AS tags
         FROM spends s
         LEFT JOIN spend_tags st ON st.spend_id = s.id
         LEFT JOIN tags t ON t.id = st.tag_id
         WHERE s.id = $1
         GROUP BY s.id",
        &[&id],
    )?;
    row.map(spend_from_row).transpose()
}

fn summary(client: &mut Client, args: &SummaryArgs) -> Result<Vec<SummaryRow>, AnyError> {
    let mut params: Vec<Box<dyn ToSql + Sync>> = Vec::new();
    let where_clause = build_where_clause(&args.filters, &mut params)?;
    let (select_group, join_extra) = match args.group_by {
        GroupBy::Day => ("to_char(date_trunc('day', s.timestamp), 'YYYY-MM-DD')", ""),
        GroupBy::Week => ("to_char(date_trunc('week', s.timestamp), 'IYYY-IW')", ""),
        GroupBy::Month => ("to_char(date_trunc('month', s.timestamp), 'YYYY-MM')", ""),
        GroupBy::Year => ("to_char(date_trunc('year', s.timestamp), 'YYYY')", ""),
        GroupBy::Payee => ("s.payee", ""),
        GroupBy::Tag => (
            "t.name",
            "JOIN spend_tags st ON st.spend_id = s.id JOIN tags t ON t.id = st.tag_id",
        ),
    };
    let query = format!(
        "SELECT {select_group} AS group_name, SUM(s.amount)::text AS total, COUNT(DISTINCT s.id) AS count
         FROM spends s
         {join_extra}
         {where_clause}
         GROUP BY group_name
         ORDER BY group_name"
    );
    let refs: Vec<&(dyn ToSql + Sync)> = params.iter().map(|p| p.as_ref()).collect();
    let mut summaries = Vec::new();
    for row in client.query(&query, &refs)? {
        summaries.push(SummaryRow {
            group: row.get(0),
            total: Decimal::from_str(row.get::<_, String>(1).as_str())?,
            count: row.get(2),
        });
    }
    Ok(summaries)
}

fn build_where_clause(
    filters: &FilterArgs,
    params: &mut Vec<Box<dyn ToSql + Sync>>,
) -> Result<String, AnyError> {
    let mut parts = Vec::new();
    for tag in &filters.tag {
        params.push(Box::new(tag.clone()));
        parts.push(format!(
            "EXISTS (SELECT 1 FROM spend_tags fst JOIN tags ft ON ft.id = fst.tag_id WHERE fst.spend_id = s.id AND ft.name = ${})",
            params.len()
        ));
    }
    if let Some(payee) = &filters.payee {
        params.push(Box::new(payee.clone()));
        parts.push(format!("s.payee = ${}", params.len()));
    }
    if let Some(date_start) = &filters.date_start {
        let timestamp = parse_filter_start(date_start)?;
        params.push(Box::new(timestamp));
        parts.push(format!("s.timestamp >= ${}", params.len()));
    }
    if let Some(date_end) = &filters.date_end {
        if let Some(next_day) = parse_date_end_exclusive(date_end)? {
            params.push(Box::new(next_day));
            parts.push(format!("s.timestamp < ${}", params.len()));
        } else {
            let timestamp = parse_timestamp(date_end)?;
            params.push(Box::new(timestamp));
            parts.push(format!("s.timestamp <= ${}", params.len()));
        }
    }
    if let Some(amount_min) = filters.amount_min {
        params.push(Box::new(format_amount(amount_min)));
        parts.push(format!("s.amount >= ${}::numeric", params.len()));
    }
    if let Some(amount_max) = filters.amount_max {
        params.push(Box::new(format_amount(amount_max)));
        parts.push(format!("s.amount <= ${}::numeric", params.len()));
    }
    if parts.is_empty() {
        Ok(String::new())
    } else {
        Ok(format!("WHERE {}", parts.join(" AND ")))
    }
}

fn validate_filters(filters: &FilterArgs) -> Result<(), AnyError> {
    if let Some(amount) = filters.amount_min {
        ensure_two_decimal_places(amount)?;
    }
    if let Some(amount) = filters.amount_max {
        ensure_two_decimal_places(amount)?;
    }
    Ok(())
}

fn existing_tag_ids(
    client: &mut Client,
    tags: &[String],
    create_missing: bool,
) -> Result<std::collections::HashMap<String, i64>, AnyError> {
    let mut tx = client.transaction()?;
    let ids = existing_tag_ids_tx(&mut tx, tags, create_missing)?;
    tx.commit()?;
    Ok(ids)
}

fn existing_tag_ids_tx(
    tx: &mut postgres::Transaction<'_>,
    tags: &[String],
    create_missing: bool,
) -> Result<std::collections::HashMap<String, i64>, AnyError> {
    let mut ids = std::collections::HashMap::new();
    for tag in tags {
        if ids.contains_key(tag) {
            continue;
        }
        let row = if create_missing {
            tx.query_one(
                "INSERT INTO tags (name) VALUES ($1)
                 ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                 RETURNING id",
                &[tag],
            )?
        } else {
            tx.query_opt("SELECT id FROM tags WHERE name = $1", &[tag])?
                .ok_or_else(|| format!("unknown tag: {tag}"))?
        };
        ids.insert(tag.clone(), row.get(0));
    }
    Ok(ids)
}

fn missing_tags(client: &mut Client, tags: &[String]) -> Result<Vec<String>, AnyError> {
    let mut missing = Vec::new();
    for tag in tags {
        let exists = client
            .query_opt("SELECT 1 FROM tags WHERE name = $1", &[tag])?
            .is_some();
        if !exists {
            missing.push(tag.clone());
        }
    }
    Ok(missing)
}

fn spend_from_row(row: Row) -> Result<Spend, AnyError> {
    Ok(Spend {
        id: row.get(0),
        timestamp: row.get(1),
        amount: Decimal::from_str(row.get::<_, String>(2).as_str())?,
        payee: row.get(3),
        note: row.get(4),
        tags: row.get(5),
    })
}

fn print_spend(spend: &Spend) {
    println!("id: {}", spend.id);
    println!("timestamp: {}", spend.timestamp.to_rfc3339());
    println!("amount: {}", format_amount(spend.amount));
    println!("payee: {}", spend.payee);
    if let Some(note) = &spend.note {
        println!("note: {note}");
    }
    println!("tags: {}", spend.tags.join(", "));
}

fn print_spends_table(spends: &[Spend]) {
    println!(
        "{:<6} {:<25} {:>12} {:<24} {}",
        "id", "timestamp", "amount", "payee", "tags"
    );
    for spend in spends {
        println!(
            "{:<6} {:<25} {:>12} {:<24} {}",
            spend.id,
            spend.timestamp.to_rfc3339(),
            format_amount(spend.amount),
            truncate(&spend.payee, 24),
            spend.tags.join(",")
        );
    }
}

fn write_spends_csv(spends: &[Spend]) -> Result<(), AnyError> {
    let mut writer = csv::Writer::from_writer(io::stdout());
    writer.write_record(["id", "timestamp", "amount", "payee", "note", "tags"])?;
    for spend in spends {
        writer.write_record([
            spend.id.to_string(),
            spend.timestamp.to_rfc3339(),
            format_amount(spend.amount),
            spend.payee.clone(),
            spend.note.clone().unwrap_or_default(),
            spend.tags.join(";"),
        ])?;
    }
    writer.flush()?;
    Ok(())
}

fn read_json_import(path: &Path) -> Result<Vec<ImportSpend>, AnyError> {
    let raw = fs::read_to_string(path)?;
    Ok(serde_json::from_str(&raw)?)
}

fn read_csv_import(path: &Path) -> Result<Vec<ImportSpend>, AnyError> {
    let mut reader = csv::Reader::from_path(path)?;
    let mut imports = Vec::new();
    for row in reader.deserialize() {
        let row: CsvImportSpend = row?;
        imports.push(ImportSpend {
            amount: row.amount,
            payee: row.payee,
            timestamp: row.timestamp,
            note: row.note,
            tags: row
                .tags
                .unwrap_or_default()
                .split(';')
                .map(str::trim)
                .filter(|tag| !tag.is_empty())
                .map(ToOwned::to_owned)
                .collect(),
        });
    }
    Ok(imports)
}

fn infer_format(path: &Path) -> Option<DataFormat> {
    match path.extension()?.to_str()? {
        "csv" => Some(DataFormat::Csv),
        "json" => Some(DataFormat::Json),
        _ => None,
    }
}

fn parse_optional_timestamp(value: Option<&str>) -> Result<Option<DateTime<Utc>>, AnyError> {
    match value {
        Some(value) => Ok(Some(parse_timestamp(value)?)),
        None => Ok(Some(Local::now().with_timezone(&Utc))),
    }
}

fn parse_timestamp(value: &str) -> Result<DateTime<Utc>, AnyError> {
    Ok(DateTime::parse_from_rfc3339(value)
        .map_err(|_| format!("timestamp must be ISO 8601 with timezone: {value}"))?
        .with_timezone(&Utc))
}

fn parse_filter_start(value: &str) -> Result<DateTime<Utc>, AnyError> {
    if let Ok(date) = NaiveDate::parse_from_str(value, "%Y-%m-%d") {
        let local = date
            .and_hms_opt(0, 0, 0)
            .ok_or("invalid date")?
            .and_local_timezone(Local)
            .single()
            .ok_or("date is ambiguous in local timezone")?;
        return Ok(local.with_timezone(&Utc));
    }
    parse_timestamp(value)
}

fn parse_date_end_exclusive(value: &str) -> Result<Option<DateTime<Utc>>, AnyError> {
    let Ok(date) = NaiveDate::parse_from_str(value, "%Y-%m-%d") else {
        return Ok(None);
    };
    let next = date
        .succ_opt()
        .ok_or("date-end is out of range")?
        .and_hms_opt(0, 0, 0)
        .ok_or("invalid date")?
        .and_local_timezone(Local)
        .single()
        .ok_or("date is ambiguous in local timezone")?;
    Ok(Some(next.with_timezone(&Utc)))
}

fn ensure_two_decimal_places(amount: Decimal) -> Result<(), AnyError> {
    if amount.scale() > 2 {
        return Err(format!("amount must have at most two decimal places: {amount}").into());
    }
    Ok(())
}

fn empty_note_to_none(note: Option<String>) -> Option<String> {
    note.and_then(|note| if note.is_empty() { None } else { Some(note) })
}

fn format_amount(amount: Decimal) -> String {
    format!("{:.2}", amount)
}

fn truncate(value: &str, max: usize) -> String {
    if value.chars().count() <= max {
        value.to_string()
    } else {
        let mut truncated: String = value.chars().take(max.saturating_sub(1)).collect();
        truncated.push('~');
        truncated
    }
}

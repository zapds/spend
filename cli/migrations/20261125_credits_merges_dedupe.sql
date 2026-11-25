BEGIN;

ALTER TABLE spends
    ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'debit';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'spends_type_check'
          AND conrelid = 'spends'::regclass
    ) THEN
        ALTER TABLE spends
            ADD CONSTRAINT spends_type_check CHECK (type IN ('debit', 'credit'));
    END IF;
END $$;

ALTER TABLE spends
    ADD COLUMN IF NOT EXISTS external_ref TEXT;

ALTER TABLE spends
    ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

ALTER TABLE spends
    ADD COLUMN IF NOT EXISTS merged_into_id BIGINT REFERENCES spends(id) ON DELETE SET NULL;

-- Backfill dedupe_key for the earliest row of each (type, UTC minute, amount, normalized payee)
-- so existing Syncthing duplicates do not fail unique index creation, while future replays are blocked.
UPDATE spends s
SET dedupe_key = sub.dk
FROM (
    SELECT DISTINCT ON (
        type,
        to_char(date_trunc('minute', timestamp AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI"Z"'),
        to_char(amount, 'FM9999999990.00'),
        lower(btrim(payee))
    )
        id,
        type
            || '|'
            || to_char(date_trunc('minute', timestamp AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI"Z"')
            || '|'
            || to_char(amount, 'FM9999999990.00')
            || '|'
            || lower(btrim(payee)) AS dk
    FROM spends
    WHERE dedupe_key IS NULL
    ORDER BY
        type,
        to_char(date_trunc('minute', timestamp AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI"Z"'),
        to_char(amount, 'FM9999999990.00'),
        lower(btrim(payee)),
        id ASC
) sub
WHERE s.id = sub.id;

CREATE INDEX IF NOT EXISTS idx_spends_type
    ON spends(type);

CREATE INDEX IF NOT EXISTS idx_spends_merged_into
    ON spends(merged_into_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_spends_external_ref
    ON spends(external_ref)
    WHERE external_ref IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_spends_dedupe_key
    ON spends(dedupe_key)
    WHERE dedupe_key IS NOT NULL;

COMMIT;

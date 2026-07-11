BEGIN;

ALTER TABLE spends
ADD COLUMN IF NOT EXISTS tag_id BIGINT REFERENCES tags(id) ON DELETE RESTRICT;

UPDATE spends s
SET tag_id = picked.tag_id
FROM (
    SELECT spend_id, MIN(tag_id) AS tag_id
    FROM spend_tags
    GROUP BY spend_id
) picked
WHERE s.id = picked.spend_id
  AND s.tag_id IS NULL;

ALTER TABLE payees
ADD COLUMN IF NOT EXISTS tag_id BIGINT;

UPDATE payees p
SET tag_id = picked.tag_id
FROM (
    SELECT payee_id, MIN(tag_id) AS tag_id
    FROM payee_tags
    GROUP BY payee_id
) picked
WHERE p.id = picked.payee_id
  AND p.tag_id IS NULL;

DELETE FROM payees
WHERE tag_id IS NULL;

ALTER TABLE payees
ALTER COLUMN tag_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'payees_tag_id_fkey'
          AND conrelid = 'payees'::regclass
    ) THEN
        ALTER TABLE payees
        ADD CONSTRAINT payees_tag_id_fkey
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_spends_tag
    ON spends(tag_id);

CREATE INDEX IF NOT EXISTS idx_payees_tag
    ON payees(tag_id);

DROP TABLE IF EXISTS payee_tags;
DROP TABLE IF EXISTS spend_tags;

COMMIT;

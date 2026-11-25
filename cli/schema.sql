CREATE TABLE tags (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE spends (
    id             BIGSERIAL PRIMARY KEY,
    timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    amount         NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    payee          TEXT NOT NULL,
    note           TEXT,
    tag_id         BIGINT REFERENCES tags(id) ON DELETE RESTRICT,
    type           TEXT NOT NULL DEFAULT 'debit' CHECK (type IN ('debit', 'credit')),
    external_ref   TEXT,
    dedupe_key     TEXT,
    merged_into_id BIGINT REFERENCES spends(id) ON DELETE SET NULL
);

CREATE INDEX idx_spends_timestamp
    ON spends(timestamp);

CREATE INDEX idx_spends_tag
    ON spends(tag_id);

CREATE INDEX idx_spends_type
    ON spends(type);

CREATE INDEX idx_spends_merged_into
    ON spends(merged_into_id);

CREATE UNIQUE INDEX uq_spends_external_ref
    ON spends(external_ref)
    WHERE external_ref IS NOT NULL;

CREATE UNIQUE INDEX uq_spends_dedupe_key
    ON spends(dedupe_key)
    WHERE dedupe_key IS NOT NULL;

CREATE TABLE payees (
    id      BIGSERIAL PRIMARY KEY,
    name    TEXT NOT NULL UNIQUE,
    tag_id  BIGINT NOT NULL REFERENCES tags(id) ON DELETE RESTRICT
);

CREATE INDEX idx_payees_tag
    ON payees(tag_id);

CREATE TABLE tags (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE spends (
    id          BIGSERIAL PRIMARY KEY,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    amount      NUMERIC(12,2) NOT NULL,
    payee       TEXT NOT NULL,
    note        TEXT,
    tag_id      BIGINT REFERENCES tags(id) ON DELETE RESTRICT
);

CREATE INDEX idx_spends_timestamp
    ON spends(timestamp);

CREATE INDEX idx_spends_tag
    ON spends(tag_id);

CREATE TABLE payees (
    id      BIGSERIAL PRIMARY KEY,
    name    TEXT NOT NULL UNIQUE,
    tag_id  BIGINT NOT NULL REFERENCES tags(id) ON DELETE RESTRICT
);

CREATE INDEX idx_payees_tag
    ON payees(tag_id);

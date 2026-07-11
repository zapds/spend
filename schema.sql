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
    note        TEXT
);

CREATE TABLE spend_tags (
    spend_id    BIGINT NOT NULL REFERENCES spends(id) ON DELETE CASCADE,
    tag_id      BIGINT NOT NULL REFERENCES tags(id) ON DELETE RESTRICT,

    PRIMARY KEY (spend_id, tag_id)
);

CREATE INDEX idx_spend_tags_tag
    ON spend_tags(tag_id);

CREATE INDEX idx_spends_timestamp
    ON spends(timestamp);

CREATE TABLE payees (
    id   BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE payee_tags (
    payee_id BIGINT NOT NULL REFERENCES payees(id) ON DELETE CASCADE,
    tag_id   BIGINT NOT NULL REFERENCES tags(id) ON DELETE RESTRICT,

    PRIMARY KEY (payee_id, tag_id)
);

CREATE INDEX idx_payee_tags_tag
    ON payee_tags(tag_id);

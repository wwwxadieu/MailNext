-- Email rules (filters): per-account, ordered conditions + actions applied
-- automatically to newly-synced messages (see src/lib/rules.ts).

CREATE TABLE IF NOT EXISTS rules (
    id              TEXT PRIMARY KEY,
    account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    enabled         INTEGER NOT NULL DEFAULT 1,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    match_type      TEXT NOT NULL DEFAULT 'all' CHECK (match_type IN ('all', 'any')),
    conditions_json TEXT NOT NULL DEFAULT '[]',
    actions_json    TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_rules_account ON rules (account_id, sort_order);

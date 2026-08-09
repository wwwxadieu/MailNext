-- Core schema for MailNext's local cache: accounts, folders, cached
-- messages, labels, signatures and app settings. Applied automatically by
-- tauri-plugin-sql on first launch.

CREATE TABLE IF NOT EXISTS accounts (
    id              TEXT PRIMARY KEY,
    email           TEXT NOT NULL UNIQUE,
    display_name    TEXT NOT NULL,
    provider        TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook', 'icloud', 'yahoo', 'custom')),
    imap_host       TEXT NOT NULL,
    imap_port       INTEGER NOT NULL,
    imap_implicit_tls INTEGER NOT NULL DEFAULT 1,
    smtp_host       TEXT NOT NULL,
    smtp_port       INTEGER NOT NULL,
    smtp_implicit_tls INTEGER NOT NULL DEFAULT 0,
    auth_type       TEXT NOT NULL CHECK (auth_type IN ('oauth2', 'password')),
    access_token    TEXT,
    refresh_token   TEXT,
    token_expires_at INTEGER,
    password_secret TEXT,
    color           TEXT NOT NULL DEFAULT '#0A84FF',
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS folders (
    id              TEXT PRIMARY KEY,
    account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    path            TEXT NOT NULL,
    special_use     TEXT,
    unread_count    INTEGER NOT NULL DEFAULT 0,
    total_count     INTEGER NOT NULL DEFAULT 0,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    UNIQUE (account_id, path)
);

CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    folder_id       TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    uid             INTEGER NOT NULL,
    message_id      TEXT NOT NULL DEFAULT '',
    subject         TEXT NOT NULL DEFAULT '(no subject)',
    from_name       TEXT,
    from_address    TEXT,
    to_json         TEXT NOT NULL DEFAULT '[]',
    cc_json         TEXT NOT NULL DEFAULT '[]',
    date            TEXT NOT NULL,
    snippet         TEXT NOT NULL DEFAULT '',
    body_html       TEXT,
    body_text       TEXT,
    is_read         INTEGER NOT NULL DEFAULT 0,
    is_flagged      INTEGER NOT NULL DEFAULT 0,
    has_attachments INTEGER NOT NULL DEFAULT 0,
    attachments_json TEXT NOT NULL DEFAULT '[]',
    UNIQUE (folder_id, uid)
);

CREATE INDEX IF NOT EXISTS idx_messages_folder_date ON messages (folder_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_messages_account ON messages (account_id);

CREATE TABLE IF NOT EXISTS labels (
    id              TEXT PRIMARY KEY,
    account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    color           TEXT NOT NULL DEFAULT '#0A84FF',
    UNIQUE (account_id, name)
);

CREATE TABLE IF NOT EXISTS message_labels (
    message_id      TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    label_id        TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    PRIMARY KEY (message_id, label_id)
);

CREATE TABLE IF NOT EXISTS signatures (
    id              TEXT PRIMARY KEY,
    account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    content_html    TEXT NOT NULL DEFAULT '',
    content_text    TEXT NOT NULL DEFAULT '',
    is_default      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES
    ('theme', 'system'),
    ('notifications_enabled', 'true'),
    ('sound_enabled', 'true'),
    ('sound_chime', 'chime-1'),
    ('poll_interval_secs', '90');

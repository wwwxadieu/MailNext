//! Registers the SQLite migrations applied by `tauri-plugin-sql` on launch.
//! The frontend owns all reads/writes against `sqlite:mailnext.db` through
//! `@tauri-apps/plugin-sql` (see `src/lib/db.ts`); this module only defines
//! the schema those queries run against.

use tauri_plugin_sql::{Migration, MigrationKind};

pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "init",
            sql: include_str!("../../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "rules",
            sql: include_str!("../../migrations/0002_rules.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

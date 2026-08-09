import Database from "@tauri-apps/plugin-sql";

let dbPromise: Promise<Database> | null = null;

/** Lazily opens (and migrates, via the Rust-registered migrations) the shared SQLite cache. */
export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load("sqlite:mailnext.db");
  }
  return dbPromise;
}

export async function dbSelect<T>(query: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  return db.select<T[]>(query, params);
}

export async function dbExecute(
  query: string,
  params: unknown[] = [],
): Promise<{ rowsAffected: number; lastInsertId?: number }> {
  const db = await getDb();
  return db.execute(query, params);
}

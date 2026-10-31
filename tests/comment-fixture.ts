import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { D1Database, Fetcher } from "@cloudflare/workers-types";
import type { CommentEnv } from "../functions/api/comments";

/** Run production queries against SQLite, with the same bound-value API as D1. */
export function fixture() {
	const sqlite = new DatabaseSync(":memory:");
	for (const name of ["0001_comments.sql", "0002_github_login.sql"]) {
		sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
	}
	class Statement {
		values: SQLInputValue[] = [];
		constructor(readonly sql: string) {}
		bind(...values: SQLInputValue[]) {
			this.values = values;
			return this;
		}
		async first() {
			return sqlite.prepare(this.sql).get(...this.values) || null;
		}
		async all() {
			return { results: sqlite.prepare(this.sql).all(...this.values) };
		}
		async run() {
			return sqlite.prepare(this.sql).run(...this.values);
		}
	}
	const env: CommentEnv = {
		COMMENTS_DB: {
			prepare: (sql: string) => new Statement(sql),
			batch: async (statements: Statement[]) => Promise.all(statements.map(statement => statement.run()))
		} as unknown as D1Database,
		ASSETS: { fetch: async () => Response.json(["/note/public", "/jotting/public"]) } as unknown as Fetcher,
		TURNSTILE_SITE_KEY: "test-site-key",
		TURNSTILE_SECRET_KEY: "test-secret"
	};
	return { env, sqlite };
}

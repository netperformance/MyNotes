// Nur für Tests am PC: bildet die genutzten expo-sqlite-Funktionen mit node:sqlite nach.
import { DatabaseSync } from 'node:sqlite'
import type { SqlDatabase } from './sqlite'

export function nodeSqlite(file: string): SqlDatabase {
  const db = new DatabaseSync(file)
  return {
    async execAsync(sql) {
      db.exec(sql)
    },
    async runAsync(sql, ...params) {
      return db.prepare(sql).run(...params)
    },
    async getAllAsync<T>(sql: string, ...params: (string | number | null)[]) {
      return db.prepare(sql).all(...params) as T[]
    },
    async getFirstAsync<T>(sql: string, ...params: (string | number | null)[]) {
      return (db.prepare(sql).get(...params) as T) ?? null
    },
    async withTransactionAsync(task) {
      db.exec('BEGIN')
      try {
        await task()
        db.exec('COMMIT')
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    },
  }
}

import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../services/logger.js', () => ({
  createChildLogger: () => ({ info: () => { }, warn: () => { }, error: () => { }, debug: () => { } }),
  logger: { info: () => { }, warn: () => { }, error: () => { }, debug: () => { } },
}))

vi.mock('../database/index.js', () => ({
  query: vi.fn(),
  isDatabaseAvailable: vi.fn(),
}))

const { splitStatements } = await import('../database/ensureSchema.js')

describe('splitStatements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('splits plain DDL statements', () => {
    const sql = `
      CREATE TABLE users (id UUID PRIMARY KEY);
      CREATE TABLE businesses (id UUID PRIMARY KEY);
    `
    const stmts = splitStatements(sql)
    expect(stmts).toHaveLength(2)
    expect(stmts[1]).toContain('CREATE TABLE businesses')
  })

  it('ignores semicolons inside single-quoted strings', () => {
    const sql = `SELECT foo FROM t WHERE x = 'a;b'; SELECT 2;`
    const stmts = splitStatements(sql)
    expect(stmts).toHaveLength(2)
    expect(stmts[0]).toContain(`x = 'a;b'`)
  })

  it('treats a PL/pgSQL function body as a single statement', () => {
    const sql = `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON users FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `
    const stmts = splitStatements(sql)
    expect(stmts).toHaveLength(2)
    expect(stmts[0]).toMatch(/^CREATE OR REPLACE FUNCTION update_updated_at_column/)
    expect(stmts[0]).toContain('END;')
    expect(stmts[0].endsWith('LANGUAGE plpgsql')).toBe(true)
    expect(stmts[1]).toContain('CREATE TRIGGER update_users_updated_at')
  })

  it('supports tagged dollar-quoted blocks', () => {
    const sql = `CREATE FUNCTION f() RETURNS void AS $body$ BEGIN NULL; END; $body$ LANGUAGE plpgsql; SELECT 1;`
    const stmts = splitStatements(sql)
    expect(stmts).toHaveLength(2)
    expect(stmts[0].endsWith('LANGUAGE plpgsql')).toBe(true)
  })

  it('drops full-line SQL comments', () => {
    const sql = `-- Updated_at trigger function\nCREATE TABLE a (id UUID);`
    const stmts = splitStatements(sql)
    expect(stmts).toHaveLength(1)
    expect(stmts[0]).toBe('CREATE TABLE a (id UUID)')
  })

  it('handles escaped single quotes', () => {
    const sql = `INSERT INTO t (v) VALUES ('it''s; fine'); SELECT 3;`
    const stmts = splitStatements(sql)
    expect(stmts).toHaveLength(2)
  })
})
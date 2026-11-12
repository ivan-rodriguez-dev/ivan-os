// Security and integrity tests against a running Supabase API (local stack by default).
// They talk to the same REST/Auth endpoints the browser uses, with real user tokens.
//   npm run stack:up && npm run test:rls
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, describe, it } from 'node:test';

const env = Object.fromEntries(
  readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => line.includes('=') && !line.startsWith('#'))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1).trim()]),
);
const URL_BASE = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;

async function signUp(tag) {
  const email = `rls-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const res = await fetch(`${URL_BASE}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password-123456', data: { full_name: `User ${tag}` } }),
  });
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  return { id: body.user.id, token: body.access_token, email };
}

/** PostgREST call as `user` (or anonymous when user is null). */
async function api(user, method, path, body) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON,
      authorization: `Bearer ${user ? user.token : ANON}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

const insert = async (user, table, row) => {
  const res = await api(user, 'POST', table, row);
  assert.equal(res.status, 201, `${table}: ${JSON.stringify(res.data)}`);
  return res.data[0];
};

let A, B;
const rows = {};

before(async () => {
  [A, B] = await Promise.all([signUp('a'), signUp('b')]);
  rows.shift_templates = await insert(A, 'shift_templates', { name: 'Mañana', kind: 'day', start_time: '06:00', end_time: '14:00' });
  rows.shift_rotations = await insert(A, 'shift_rotations', { name: 'R', pattern: [{ kind: 'rest', start_time: null, end_time: null }] });
  rows.work_shifts = await insert(A, 'work_shifts', { shift_date: '2026-11-10', kind: 'night', start_time: '22:00', end_time: '06:00' });
  rows.projects = await insert(A, 'projects', { name: 'P', area: 'academic' });
  rows.academic_tasks = await insert(A, 'academic_tasks', { title: 'T', due_date: '2026-12-01', project_id: rows.projects.id });
  rows.skills = await insert(A, 'skills', { name: 'TypeScript', category: 'programming', current_level: 3, target_level: 8 });
  rows.practice_sessions = await insert(A, 'practice_sessions', { duration_minutes: 60, skill_id: rows.skills.id });
  rows.technologies = await insert(A, 'technologies', { name: 'PostgreSQL', category: 'databases' });
  rows.languages = await insert(A, 'languages', { name: 'Inglés', current_level: 'A2', target_level: 'B2' });
  rows.language_sessions = await insert(A, 'language_sessions', { language_id: rows.languages.id, skill: 'listening', duration_minutes: 30 });
  rows.debts = await insert(A, 'debts', { name: 'Crédito', principal: '1000.00' });
  rows.savings_goals = await insert(A, 'savings_goals', { name: 'Fondo', target_amount: '500.00' });
  rows.savings_contributions = await insert(A, 'savings_contributions', { goal_id: rows.savings_goals.id, amount: '120.50' });
  rows.financial_transactions = await insert(A, 'financial_transactions', { type: 'income', amount: '2000.10', category: 'Salario', occurred_on: '2026-11-01' });
  rows.goals = await insert(A, 'goals', { title: 'G', target_value: 10 });
  rows.habits = await insert(A, 'habits', { name: 'Leer' });
  rows.habit_logs = await insert(A, 'habit_logs', { habit_id: rows.habits.id, log_date: '2026-11-10' });
});

const TABLES = [
  'shift_templates', 'shift_rotations', 'work_shifts', 'projects', 'academic_tasks', 'skills', 'practice_sessions', 'technologies',
  'languages', 'language_sessions', 'debts', 'savings_goals', 'savings_contributions', 'financial_transactions', 'goals', 'habits', 'habit_logs',
];
const READ_ONLY = ['profiles', 'skill_level_logs', 'debt_balances', 'savings_goal_progress', 'monthly_balances'];

describe('anonymous access', () => {
  for (const table of [...TABLES, ...READ_ONLY]) {
    it(`cannot read ${table}`, async () => {
      const res = await api(null, 'GET', `${table}?select=*`);
      assert.ok(res.status === 401 || res.status === 403, `expected 401/403, got ${res.status} ${JSON.stringify(res.data)}`);
    });
  }
  it('cannot insert', async () => {
    const res = await api(null, 'POST', 'goals', { title: 'x', target_value: 1, user_id: A.id });
    assert.ok(res.status === 401 || res.status === 403);
  });
});

describe('isolation between users', () => {
  for (const table of TABLES) {
    it(`${table}: owner sees the row, other user does not`, async () => {
      const own = await api(A, 'GET', `${table}?select=id`);
      assert.equal(own.status, 200);
      assert.ok(own.data.some((r) => r.id === rows[table].id));
      const other = await api(B, 'GET', `${table}?select=id`);
      assert.equal(other.status, 200);
      assert.deepEqual(other.data, []);
    });
    it(`${table}: other user cannot update or delete the row`, async () => {
      if (table !== 'habit_logs') {
        const upd = await api(B, 'PATCH', `${table}?id=eq.${rows[table].id}`, { updated_at: new Date().toISOString() });
        assert.deepEqual(upd.data, [], 'update must affect 0 rows');
      }
      const del = await api(B, 'DELETE', `${table}?id=eq.${rows[table].id}`);
      assert.deepEqual(del.data, [], 'delete must affect 0 rows');
      const still = await api(A, 'GET', `${table}?select=id&id=eq.${rows[table].id}`);
      assert.equal(still.data.length, 1);
    });
  }

  for (const view of READ_ONLY) {
    it(`${view}: other user sees none of the owner's rows`, async () => {
      const res = await api(B, 'GET', `${view}?select=*`);
      assert.equal(res.status, 200);
      const leaked = res.data.filter((r) => (r.user_id ?? r.id) === A.id);
      assert.deepEqual(leaked, []);
      if (view !== 'profiles') assert.deepEqual(res.data, []);
    });
  }

  it('cannot insert a row owned by someone else', async () => {
    const res = await api(B, 'POST', 'goals', { title: 'forged', target_value: 1, user_id: A.id });
    assert.equal(res.status, 403, JSON.stringify(res.data));
  });

  it('cannot move an own row to another user', async () => {
    const mine = await insert(B, 'goals', { title: 'mine', target_value: 1 });
    const res = await api(B, 'PATCH', `goals?id=eq.${mine.id}`, { user_id: A.id });
    assert.equal(res.status, 403, JSON.stringify(res.data));
  });

  const CROSS = [
    ['academic_tasks', (r) => ({ title: 'x', due_date: '2026-12-01', project_id: r.projects.id })],
    ['practice_sessions', (r) => ({ duration_minutes: 10, skill_id: r.skills.id })],
    ['practice_sessions', (r) => ({ duration_minutes: 10, project_id: r.projects.id })],
    ['language_sessions', (r) => ({ language_id: r.languages.id, skill: 'reading', duration_minutes: 10 })],
    ['financial_transactions', (r) => ({ type: 'expense', amount: '1.00', category: 'Pago de deuda', debt_id: r.debts.id })],
    ['savings_contributions', (r) => ({ goal_id: r.savings_goals.id, amount: '1.00' })],
    ['habit_logs', (r) => ({ habit_id: r.habits.id, log_date: '2026-11-11' })],
    ['work_shifts', (r) => ({ shift_date: '2026-11-12', kind: 'rest', rotation_id: r.shift_rotations.id })],
  ];
  for (const [table, build] of CROSS) {
    it(`${table}: cannot reference another user's parent row`, async () => {
      const res = await api(B, 'POST', table, build(rows));
      assert.equal(res.status, 409, JSON.stringify(res.data));
      assert.equal(res.data.code, '23503');
    });
  }

  it("cannot update another user's profile, nor insert or delete profiles", async () => {
    const upd = await api(B, 'PATCH', `profiles?id=eq.${A.id}`, { full_name: 'hacked' });
    assert.deepEqual(upd.data, []);
    const profile = await api(A, 'GET', `profiles?select=full_name&id=eq.${A.id}`);
    assert.equal(profile.data[0].full_name, 'User a');
    assert.equal((await api(B, 'DELETE', `profiles?id=eq.${B.id}`)).status, 403);
    assert.equal((await api(B, 'POST', 'profiles', { id: B.id })).status, 403);
  });

  it('skill level history is read-only for users and written by trigger', async () => {
    assert.equal((await api(A, 'POST', 'skill_level_logs', { user_id: A.id, skill_id: rows.skills.id, level: 9 })).status, 403);
    await api(A, 'PATCH', `skills?id=eq.${rows.skills.id}`, { current_level: 4 });
    const logs = await api(A, 'GET', `skill_level_logs?select=level&skill_id=eq.${rows.skills.id}&order=logged_at`);
    assert.deepEqual(logs.data.map((l) => l.level), [3, 4]);
  });
});

describe('data integrity', () => {
  const rejected = async (user, table, row, code = '23514') => {
    const res = await api(user, 'POST', table, row);
    assert.equal(res.status, 400, `${table} ${JSON.stringify(row)} -> ${res.status} ${JSON.stringify(res.data)}`);
    assert.equal(res.data.code, code);
  };

  it('shift rules: rest days carry no times, working shifts need two different times', async () => {
    await rejected(A, 'work_shifts', { shift_date: '2026-11-13', kind: 'rest', start_time: '06:00', end_time: '14:00' });
    await rejected(A, 'work_shifts', { shift_date: '2026-11-13', kind: 'day' });
    await rejected(A, 'work_shifts', { shift_date: '2026-11-13', kind: 'day', start_time: '06:00', end_time: '06:00' });
    await rejected(A, 'work_shifts', { shift_date: '2026-11-13', kind: 'weird', start_time: '06:00', end_time: '07:00' });
    await insert(A, 'work_shifts', { shift_date: '2026-11-13', kind: 'rest' });
    const dup = await api(A, 'POST', 'work_shifts', { shift_date: '2026-11-13', kind: 'rest' });
    assert.equal(dup.status, 409);
  });

  it('rejects invalid amounts, levels, durations and statuses', async () => {
    await rejected(A, 'financial_transactions', { type: 'expense', amount: '0', category: 'x' });
    await rejected(A, 'financial_transactions', { type: 'expense', amount: '-5', category: 'x' });
    await rejected(A, 'financial_transactions', { type: 'income', amount: '5', category: 'x', debt_id: rows.debts.id });
    await rejected(A, 'skills', { name: 'bad', category: 'programming', current_level: 11 });
    await rejected(A, 'practice_sessions', { duration_minutes: 0 });
    await rejected(A, 'practice_sessions', { duration_minutes: 1441 });
    await rejected(A, 'languages', { name: 'Klingon', current_level: 'Z9', target_level: 'B2' });
    await rejected(A, 'academic_tasks', { title: 'x', due_date: '2026-12-01', status: 'completed' });
    await rejected(A, 'academic_tasks', { title: '', due_date: '2026-12-01' });
    await rejected(A, 'habits', { name: 'x', target_per_week: 8 });
  });

  it('amounts are stored with exactly two decimals', async () => {
    const row = await insert(A, 'financial_transactions', { type: 'expense', amount: '0.105', category: 'Redondeo', occurred_on: '2020-01-01' });
    assert.equal(Number(row.amount), 0.11);
    await api(A, 'DELETE', `financial_transactions?id=eq.${row.id}`);
  });
});

describe('financial calculations in the database', () => {
  it('monthly balance = income − expenses, debt payments included', async () => {
    await insert(A, 'financial_transactions', { type: 'expense', amount: '0.10', category: 'Transporte', occurred_on: '2026-11-02' });
    await insert(A, 'financial_transactions', { type: 'expense', amount: '0.20', category: 'Transporte', occurred_on: '2026-11-03' });
    await insert(A, 'financial_transactions', { type: 'expense', amount: '799.70', category: 'Vivienda', occurred_on: '2026-11-30' });
    await insert(A, 'financial_transactions', { type: 'expense', amount: '400.00', category: 'Pago de deuda', occurred_on: '2026-11-15', debt_id: rows.debts.id });
    await insert(A, 'financial_transactions', { type: 'income', amount: '50.00', category: 'Ventas', occurred_on: '2026-12-01' });
    const res = await api(A, 'GET', 'monthly_balances?select=month,income,expense,balance&order=month');
    assert.deepEqual(res.data, [
      { month: '2026-11-01', income: 2000.1, expense: 1200, balance: 800.1 },
      { month: '2026-12-01', income: 50, expense: 0, balance: 50 },
    ]);
  });

  it('debt balance follows payments; overpaying is rejected', async () => {
    let debt = (await api(A, 'GET', `debt_balances?select=principal,paid,remaining&id=eq.${rows.debts.id}`)).data[0];
    assert.deepEqual(debt, { principal: 1000, paid: 400, remaining: 600 });

    const over = await api(A, 'POST', 'financial_transactions', { type: 'expense', amount: '600.01', category: 'Pago de deuda', debt_id: rows.debts.id });
    assert.equal(over.status, 400);
    assert.match(over.data.message, /El pago supera el saldo pendiente/);

    const exact = await insert(A, 'financial_transactions', { type: 'expense', amount: '600.00', category: 'Pago de deuda', occurred_on: '2026-12-05', debt_id: rows.debts.id });
    debt = (await api(A, 'GET', `debt_balances?select=paid,remaining&id=eq.${rows.debts.id}`)).data[0];
    assert.deepEqual(debt, { paid: 1000, remaining: 0 });

    const raise = await api(A, 'PATCH', `financial_transactions?id=eq.${exact.id}`, { amount: '600.01' });
    assert.equal(raise.status, 400, 'editing a payment above the balance must fail');
    const shrink = await api(A, 'PATCH', `debts?id=eq.${rows.debts.id}`, { principal: '999.99' });
    assert.equal(shrink.status, 400, 'principal below the paid amount must fail');
    assert.match(shrink.data.message, /no puede ser menor que lo ya pagado/);
  });

  it('deleting a debt keeps its payments as expenses', async () => {
    const before = (await api(A, 'GET', 'monthly_balances?select=expense&month=eq.2026-11-01')).data[0].expense;
    assert.equal((await api(A, 'DELETE', `debts?id=eq.${rows.debts.id}`)).status, 200);
    const after = (await api(A, 'GET', 'monthly_balances?select=expense&month=eq.2026-11-01')).data[0].expense;
    assert.equal(after, before);
    const orphans = await api(A, 'GET', 'financial_transactions?select=debt_id&category=eq.Pago%20de%20deuda');
    assert.equal(orphans.data.length, 2);
    assert.ok(orphans.data.every((t) => t.debt_id === null));
  });

  it('savings progress sums contributions', async () => {
    await insert(A, 'savings_contributions', { goal_id: rows.savings_goals.id, amount: '79.50' });
    const goal = (await api(A, 'GET', `savings_goal_progress?select=target_amount,saved&id=eq.${rows.savings_goals.id}`)).data[0];
    assert.deepEqual(goal, { target_amount: 500, saved: 200 });
  });
});

describe('cascades', () => {
  it('deleting a parent applies the documented rule to its children', async () => {
    await api(A, 'DELETE', `projects?id=eq.${rows.projects.id}`);
    const task = (await api(A, 'GET', `academic_tasks?select=project_id&id=eq.${rows.academic_tasks.id}`)).data[0];
    assert.equal(task.project_id, null, 'task survives without project');
    await api(A, 'DELETE', `languages?id=eq.${rows.languages.id}`);
    assert.deepEqual((await api(A, 'GET', 'language_sessions?select=id')).data, [], 'sessions go with the language');
    await api(A, 'DELETE', `habits?id=eq.${rows.habits.id}`);
    assert.deepEqual((await api(A, 'GET', 'habit_logs?select=id')).data, []);
  });
});

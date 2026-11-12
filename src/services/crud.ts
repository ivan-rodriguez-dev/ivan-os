import { toAppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import type { Writable } from '@/types/database';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Query = any; // PostgREST filter builder; kept loose so callers can chain any filter.

export interface ListOptions {
  /** Adds filters/ordering to the base `select *` query. */
  filter?: (query: Query) => Query;
  orderBy?: string;
  ascending?: boolean;
}

/** Unwraps a Supabase response, converting failures into AppError. */
export async function run<T>(request: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  let response: { data: T | null; error: unknown };
  try {
    response = await request;
  } catch (error) {
    throw toAppError(error);
  }
  if (response.error) throw toAppError(response.error);
  return response.data as T;
}

/**
 * Typed CRUD access to one table. user_id is never sent by the client:
 * the column defaults to auth.uid() and RLS rejects anything else.
 */
export function createCrud<Row extends { id: string }>(table: string, defaults: ListOptions = {}) {
  const from = (): Query => getSupabase().from(table);

  return {
    list(options: ListOptions = {}): Promise<Row[]> {
      const { filter, orderBy, ascending } = { ...defaults, ...options };
      let query: Query = from().select('*');
      if (filter) query = filter(query);
      if (orderBy) query = query.order(orderBy, { ascending: ascending ?? true });
      return run<Row[]>(query);
    },
    create(values: Writable<Row>): Promise<Row> {
      return run<Row>(from().insert(values).select().single());
    },
    createMany(values: Writable<Row>[]): Promise<Row[]> {
      if (values.length === 0) return Promise.resolve([]);
      return run<Row[]>(from().insert(values).select());
    },
    update(id: string, values: Writable<Row>): Promise<Row> {
      return run<Row>(from().update(values).eq('id', id).select().single());
    },
    async remove(id: string): Promise<void> {
      await run(from().delete().eq('id', id).select('id').single());
    },
  };
}

/** Read-only access to a view. */
export function createReader<Row>(view: string, defaults: ListOptions = {}) {
  return {
    list(options: ListOptions = {}): Promise<Row[]> {
      const { filter, orderBy, ascending } = { ...defaults, ...options };
      let query: Query = getSupabase().from(view).select('*');
      if (filter) query = filter(query);
      if (orderBy) query = query.order(orderBy, { ascending: ascending ?? true });
      return run<Row[]>(query);
    },
  };
}

import { generateRotation, type RotationStep } from '@/lib/shifts';
import { getSupabase } from '@/lib/supabase';
import type {
  AcademicTask,
  Debt,
  DebtBalance,
  FinancialTransaction,
  Goal,
  Habit,
  HabitLog,
  Language,
  LanguageSession,
  PracticeSession,
  Profile,
  Project,
  SavingsContribution,
  SavingsGoal,
  SavingsGoalProgress,
  ShiftRotation,
  ShiftTemplate,
  Skill,
  SkillLevelLog,
  Technology,
  WorkShift,
} from '@/types/database';
import { createCrud, createReader, run } from './crud';

export const shiftTemplates = createCrud<ShiftTemplate>('shift_templates', { orderBy: 'start_time' });
export const shiftRotations = createCrud<ShiftRotation>('shift_rotations', { orderBy: 'created_at' });
export const projects = createCrud<Project>('projects', { orderBy: 'created_at', ascending: false });
export const academicTasks = createCrud<AcademicTask>('academic_tasks', { orderBy: 'due_date' });
export const skills = createCrud<Skill>('skills', { orderBy: 'name' });
export const skillLevelLogs = createReader<SkillLevelLog>('skill_level_logs', { orderBy: 'logged_at' });
export const practiceSessions = createCrud<PracticeSession>('practice_sessions', { orderBy: 'session_date', ascending: false });
export const technologies = createCrud<Technology>('technologies', { orderBy: 'name' });
export const languages = createCrud<Language>('languages', { orderBy: 'name' });
export const languageSessions = createCrud<LanguageSession>('language_sessions', { orderBy: 'session_date', ascending: false });
export const transactions = createCrud<FinancialTransaction>('financial_transactions', { orderBy: 'occurred_on', ascending: false });
export const debts = createCrud<Debt>('debts');
export const debtBalances = createReader<DebtBalance>('debt_balances', { orderBy: 'created_at' });
export const savingsGoals = createCrud<SavingsGoal>('savings_goals');
export const savingsProgress = createReader<SavingsGoalProgress>('savings_goal_progress', { orderBy: 'created_at' });
export const savingsContributions = createCrud<SavingsContribution>('savings_contributions', { orderBy: 'contributed_on', ascending: false });
export const goals = createCrud<Goal>('goals', { orderBy: 'created_at' });
export const habits = createCrud<Habit>('habits', { orderBy: 'created_at' });

const shiftsCrud = createCrud<WorkShift>('work_shifts', { orderBy: 'shift_date' });

export const workShifts = {
  ...shiftsCrud,
  between(from: string, to: string): Promise<WorkShift[]> {
    return shiftsCrud.list({
      filter: (q) => q.gte('shift_date', from).lte('shift_date', to).order('shift_date').order('start_time', { nullsFirst: true }),
      orderBy: undefined,
    });
  },
  /** Fills [from, to] with the rotation cycle. With `replace`, existing shifts in the range are removed first. */
  async applyRotation(rotation: { id: string; pattern: RotationStep[] }, from: string, to: string, replace: boolean): Promise<number> {
    if (replace) {
      await run(getSupabase().from('work_shifts').delete().gte('shift_date', from).lte('shift_date', to).select('id'));
    }
    const rows = generateRotation(rotation.pattern, from, to).map((row) => ({ ...row, rotation_id: rotation.id }));
    const created = await shiftsCrud.createMany(rows);
    return created.length;
  },
};

export const habitLogs = {
  between(from: string, to: string): Promise<HabitLog[]> {
    return run<HabitLog[]>(getSupabase().from('habit_logs').select('*').gte('log_date', from).lte('log_date', to));
  },
  async set(habitId: string, date: string, done: boolean): Promise<void> {
    const table = getSupabase().from('habit_logs');
    if (done) {
      await run(table.upsert({ habit_id: habitId, log_date: date }, { onConflict: 'habit_id,log_date', ignoreDuplicates: true }).select('id'));
    } else {
      await run(table.delete().eq('habit_id', habitId).eq('log_date', date).select('id'));
    }
  },
};

export const profiles = {
  get(userId: string): Promise<Profile | null> {
    return run<Profile | null>(getSupabase().from('profiles').select('id, full_name, currency').eq('id', userId).maybeSingle());
  },
  update(userId: string, values: Pick<Profile, 'full_name' | 'currency'>): Promise<Profile> {
    return run<Profile>(getSupabase().from('profiles').update(values).eq('id', userId).select('id, full_name, currency').single());
  },
};

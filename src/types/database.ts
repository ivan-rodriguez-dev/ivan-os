// Row shapes of the public schema (see supabase/migrations).
// numeric columns arrive as numbers from PostgREST; convert with toCents() before doing math.
import type { RotationStep, ShiftKind } from '@/lib/shifts';

interface Owned {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  currency: string;
}

export interface ShiftTemplate extends Owned {
  name: string;
  kind: Exclude<ShiftKind, 'rest'>;
  start_time: string;
  end_time: string;
}

export interface ShiftRotation extends Owned {
  name: string;
  pattern: RotationStep[];
}

export interface WorkShift extends Owned {
  shift_date: string;
  kind: ShiftKind;
  start_time: string | null;
  end_time: string | null;
  label: string;
  notes: string;
  rotation_id: string | null;
}

export type ProjectArea = 'academic' | 'personal';
export type ProjectStatus = 'planned' | 'active' | 'paused' | 'completed';

export interface Project extends Owned {
  name: string;
  description: string;
  area: ProjectArea;
  status: ProjectStatus;
  technologies: string[];
  repo_url: string;
  due_date: string | null;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface AcademicTask extends Owned {
  project_id: string | null;
  title: string;
  description: string;
  course: string;
  due_date: string;
  priority: TaskPriority;
  status: TaskStatus;
  completed_at: string | null;
}

export type SkillCategory = 'programming' | 'databases' | 'architecture' | 'web' | 'devops' | 'other';

export interface Skill extends Owned {
  name: string;
  category: SkillCategory;
  current_level: number;
  target_level: number;
  notes: string;
}

export interface SkillLevelLog {
  id: string;
  skill_id: string;
  level: number;
  logged_at: string;
}

export type PracticeKind = 'coding' | 'study' | 'course' | 'reading' | 'other';

export interface PracticeSession extends Owned {
  skill_id: string | null;
  project_id: string | null;
  session_date: string;
  duration_minutes: number;
  kind: PracticeKind;
  notes: string;
}

export type Proficiency = 'learning' | 'comfortable' | 'proficient';

export interface Technology extends Owned {
  name: string;
  category: SkillCategory;
  proficiency: Proficiency;
  learned_on: string | null;
  notes: string;
}

export type CefrLevel = 'A0' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface Language extends Owned {
  name: string;
  current_level: CefrLevel;
  target_level: Exclude<CefrLevel, 'A0'>;
  notes: string;
}

export type LanguageSkill = 'listening' | 'speaking' | 'reading' | 'writing';

export interface LanguageSession extends Owned {
  language_id: string;
  skill: LanguageSkill;
  session_date: string;
  duration_minutes: number;
  notes: string;
}

export interface FinancialTransaction extends Owned {
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  occurred_on: string;
  debt_id: string | null;
}

export interface Debt extends Owned {
  name: string;
  creditor: string;
  principal: number;
  due_date: string | null;
  notes: string;
}

/** Row of the debt_balances view. */
export interface DebtBalance extends Omit<Debt, 'updated_at'> {
  paid: number;
  remaining: number;
}

export interface SavingsGoal extends Owned {
  name: string;
  target_amount: number;
  target_date: string | null;
  notes: string;
}

/** Row of the savings_goal_progress view. */
export interface SavingsGoalProgress extends Omit<SavingsGoal, 'updated_at'> {
  saved: number;
}

export interface SavingsContribution extends Owned {
  goal_id: string;
  amount: number;
  contributed_on: string;
  notes: string;
}

export type GoalArea = 'work' | 'academic' | 'skills' | 'languages' | 'finance' | 'personal';

export interface Goal extends Owned {
  title: string;
  area: GoalArea;
  unit: string;
  target_value: number;
  current_value: number;
  due_date: string | null;
}

export interface Habit extends Owned {
  name: string;
  target_per_week: number;
  archived: boolean;
}

export interface HabitLog {
  id: string;
  user_id: string;
  habit_id: string;
  log_date: string;
  created_at: string;
}

/** Columns a client may send on insert/update for a row type. */
export type Writable<Row> = Partial<Omit<Row, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

import type { CefrLevel, GoalArea, LanguageSkill, PracticeKind, Proficiency, ProjectStatus, SkillCategory, TaskPriority, TaskStatus } from '@/types/database';

export const PRIORITY_LABEL: Record<TaskPriority, string> = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };
export const PRIORITY_TONE: Record<TaskPriority, 'neutral' | 'accent' | 'warn' | 'danger'> = { low: 'neutral', medium: 'accent', high: 'warn', urgent: 'danger' };
export const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = { pending: 'Pendiente', in_progress: 'En progreso', completed: 'Completada' };

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = { planned: 'Planeado', active: 'Activo', paused: 'En pausa', completed: 'Completado' };
export const PROJECT_STATUS_TONE: Record<ProjectStatus, 'neutral' | 'accent' | 'warn' | 'ok'> = { planned: 'neutral', active: 'accent', paused: 'warn', completed: 'ok' };

export const SKILL_CATEGORY_LABEL: Record<SkillCategory, string> = {
  programming: 'Programación',
  databases: 'Bases de datos',
  architecture: 'Arquitectura de software',
  web: 'Desarrollo web',
  devops: 'DevOps',
  other: 'Otra',
};

export const PRACTICE_KIND_LABEL: Record<PracticeKind, string> = { coding: 'Programación', study: 'Estudio', course: 'Curso', reading: 'Lectura', other: 'Otra' };

export const PROFICIENCY_LABEL: Record<Proficiency, string> = { learning: 'Aprendiendo', comfortable: 'Con soltura', proficient: 'Dominio' };
export const PROFICIENCY_TONE: Record<Proficiency, 'neutral' | 'accent' | 'ok'> = { learning: 'neutral', comfortable: 'accent', proficient: 'ok' };

export const CEFR_LEVELS: readonly CefrLevel[] = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const CEFR_LABEL: Record<CefrLevel, string> = {
  A0: 'A0 · Sin conocimientos',
  A1: 'A1 · Principiante',
  A2: 'A2 · Básico',
  B1: 'B1 · Intermedio',
  B2: 'B2 · Intermedio alto',
  C1: 'C1 · Avanzado',
  C2: 'C2 · Maestría',
};

export const LANGUAGE_SKILL_LABEL: Record<LanguageSkill, string> = { listening: 'Listening', speaking: 'Speaking', reading: 'Reading', writing: 'Writing' };

export const GOAL_AREA_LABEL: Record<GoalArea, string> = {
  work: 'Trabajo',
  academic: 'Educación',
  skills: 'Desarrollo profesional',
  languages: 'Idiomas',
  finance: 'Finanzas',
  personal: 'Personal',
};

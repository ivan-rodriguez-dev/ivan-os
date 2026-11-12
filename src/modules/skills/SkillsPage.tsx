import { Cpu, Plus, Sparkles, Timer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Badge,
  Button,
  CHART,
  DeleteDialog,
  EmptyState,
  FormActions,
  Input,
  Modal,
  PageHeader,
  Panel,
  ProgressBar,
  QueryView,
  RowActions,
  Select,
  Stat,
  Tabs,
  Textarea,
  axisProps,
  optionsFrom,
  tooltipProps,
  useEditor,
  type EditorTarget,
} from '@/components/ui';
import { useAction } from '@/hooks/useAction';
import { useForm } from '@/hooks/useForm';
import { useQuery } from '@/hooks/useQuery';
import { formatDate, formatMinutes, monthKeyOf, startOfMonth, startOfWeek, todayISO, toISODate } from '@/lib/dates';
import { PRACTICE_KIND_LABEL, PROFICIENCY_LABEL, PROFICIENCY_TONE, SKILL_CATEGORY_LABEL } from '@/lib/labels';
import { percentOf } from '@/lib/money';
import { minutesBetween, totalMinutes, weeklyBuckets, type TimedEntry } from '@/lib/sessions';
import { integerBetween, isoDate, maxLength, required, type Rule } from '@/lib/validation';
import { DurationFields, durationMinutes, durationRule, toDuration } from '@/modules/shared/DurationFields';
import { HoursChart } from '@/modules/shared/HoursChart';
import { ProjectsPanel } from '@/modules/shared/ProjectsPanel';
import { practiceSessions, projects, skillLevelLogs, skills, technologies } from '@/services';
import type { PracticeKind, PracticeSession, Proficiency, Project, Skill, SkillCategory, SkillLevelLog, Technology } from '@/types/database';

type Tab = 'skills' | 'sessions' | 'projects' | 'technologies';

const CATEGORY_ORDER = Object.keys(SKILL_CATEGORY_LABEL) as SkillCategory[];

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------
const targetAtLeastCurrent: Rule<{ current_level: string; target_level: string }> = (_v, values) =>
  Number(values.target_level) < Number(values.current_level) ? 'El objetivo no puede ser menor que el nivel actual' : null;

function SkillForm({ target, onClose, onSaved }: { target: EditorTarget<Skill>; onClose: () => void; onSaved: () => void }) {
  const editing = target.mode === 'edit' ? target.row : null;
  const { run, pending } = useAction();
  const form = useForm(
    {
      name: editing?.name ?? '',
      category: (editing?.category ?? 'programming') as SkillCategory,
      current_level: String(editing?.current_level ?? 1),
      target_level: String(editing?.target_level ?? 8),
      notes: editing?.notes ?? '',
    },
    { name: [required(), maxLength(80)], current_level: [integerBetween(0, 10)], target_level: [integerBetween(1, 10), targetAtLeastCurrent], notes: [maxLength(2000)] },
  );
  const v = form.values;

  const save = form.submit(async (values) => {
    const payload = {
      name: values.name.trim(),
      category: values.category,
      current_level: Number(values.current_level),
      target_level: Number(values.target_level),
      notes: values.notes.trim(),
    };
    const ok = await run(() => (editing ? skills.update(editing.id, payload) : skills.create(payload)), editing ? 'Habilidad actualizada.' : 'Habilidad creada.');
    if (ok) {
      onClose();
      onSaved();
    }
  });

  return (
    <Modal open title={editing ? 'Editar habilidad' : 'Nueva habilidad'} onClose={onClose}>
      <form noValidate onSubmit={save} className="flex flex-col gap-4">
        <Input label="Nombre" placeholder="Ej. TypeScript" value={v.name} error={form.errors.name} onChange={(e) => form.set('name', e.target.value)} />
        <Select label="Categoría" value={v.category} options={optionsFrom(SKILL_CATEGORY_LABEL)} onChange={(e) => form.set('category', e.target.value as SkillCategory)} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nivel actual (0–10)" type="number" inputMode="numeric" min={0} max={10} value={v.current_level} error={form.errors.current_level} onChange={(e) => form.set('current_level', e.target.value)} />
          <Input label="Nivel objetivo (1–10)" type="number" inputMode="numeric" min={1} max={10} value={v.target_level} error={form.errors.target_level} onChange={(e) => form.set('target_level', e.target.value)} />
        </div>
        <Textarea label="Notas (opcional)" value={v.notes} error={form.errors.notes} onChange={(e) => form.set('notes', e.target.value)} />
        <FormActions onCancel={onClose} pending={pending} />
      </form>
    </Modal>
  );
}

interface SessionFormProps {
  target: EditorTarget<PracticeSession>;
  skillList: Skill[];
  projectList: Project[];
  onClose: () => void;
  onSaved: () => void;
}

function SessionForm({ target, skillList, projectList, onClose, onSaved }: SessionFormProps) {
  const editing = target.mode === 'edit' ? target.row : null;
  const { run, pending } = useAction();
  const form = useForm(
    {
      session_date: editing?.session_date ?? todayISO(),
      ...toDuration(editing?.duration_minutes),
      kind: (editing?.kind ?? 'coding') as PracticeKind,
      skill_id: editing?.skill_id ?? '',
      project_id: editing?.project_id ?? '',
      notes: editing?.notes ?? '',
    },
    { session_date: [isoDate()], hours: [durationRule], notes: [maxLength(2000)] },
  );
  const v = form.values;

  const save = form.submit(async (values) => {
    const payload = {
      session_date: values.session_date,
      duration_minutes: durationMinutes(values),
      kind: values.kind,
      skill_id: values.skill_id || null,
      project_id: values.project_id || null,
      notes: values.notes.trim(),
    };
    const ok = await run(() => (editing ? practiceSessions.update(editing.id, payload) : practiceSessions.create(payload)), editing ? 'Sesión actualizada.' : 'Sesión registrada.');
    if (ok) {
      onClose();
      onSaved();
    }
  });

  return (
    <Modal open title={editing ? 'Editar sesión' : 'Registrar sesión de práctica'} onClose={onClose}>
      <form noValidate onSubmit={save} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Fecha" type="date" value={v.session_date} error={form.errors.session_date} onChange={(e) => form.set('session_date', e.target.value)} />
          <Select label="Tipo" value={v.kind} options={optionsFrom(PRACTICE_KIND_LABEL)} onChange={(e) => form.set('kind', e.target.value as PracticeKind)} />
        </div>
        <DurationFields values={v} error={form.errors.hours} onChange={(key, value) => form.set(key, value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Habilidad (opcional)" value={v.skill_id} placeholder="Sin habilidad" options={skillList.map((s) => ({ value: s.id, label: s.name }))} onChange={(e) => form.set('skill_id', e.target.value)} />
          <Select label="Proyecto (opcional)" value={v.project_id} placeholder="Sin proyecto" options={projectList.map((p) => ({ value: p.id, label: p.name }))} onChange={(e) => form.set('project_id', e.target.value)} />
        </div>
        <Textarea label="Notas (opcional)" placeholder="¿Qué practicaste o aprendiste?" value={v.notes} error={form.errors.notes} onChange={(e) => form.set('notes', e.target.value)} />
        <FormActions onCancel={onClose} pending={pending} />
      </form>
    </Modal>
  );
}

function TechnologyForm({ target, onClose, onSaved }: { target: EditorTarget<Technology>; onClose: () => void; onSaved: () => void }) {
  const editing = target.mode === 'edit' ? target.row : null;
  const { run, pending } = useAction();
  const form = useForm(
    {
      name: editing?.name ?? '',
      category: (editing?.category ?? 'programming') as SkillCategory,
      proficiency: (editing?.proficiency ?? 'learning') as Proficiency,
      learned_on: editing?.learned_on ?? '',
      notes: editing?.notes ?? '',
    },
    { name: [required(), maxLength(80)], learned_on: [isoDate(true)], notes: [maxLength(2000)] },
  );
  const v = form.values;

  const save = form.submit(async (values) => {
    const payload = { ...values, name: values.name.trim(), notes: values.notes.trim(), learned_on: values.learned_on || null };
    const ok = await run(() => (editing ? technologies.update(editing.id, payload) : technologies.create(payload)), editing ? 'Tecnología actualizada.' : 'Tecnología documentada.');
    if (ok) {
      onClose();
      onSaved();
    }
  });

  return (
    <Modal open title={editing ? 'Editar tecnología' : 'Documentar tecnología'} onClose={onClose}>
      <form noValidate onSubmit={save} className="flex flex-col gap-4">
        <Input label="Nombre" placeholder="Ej. PostgreSQL" value={v.name} error={form.errors.name} onChange={(e) => form.set('name', e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Categoría" value={v.category} options={optionsFrom(SKILL_CATEGORY_LABEL)} onChange={(e) => form.set('category', e.target.value as SkillCategory)} />
          <Select label="Dominio" value={v.proficiency} options={optionsFrom(PROFICIENCY_LABEL)} onChange={(e) => form.set('proficiency', e.target.value as Proficiency)} />
        </div>
        <Input label="Aprendida desde (opcional)" type="date" value={v.learned_on} error={form.errors.learned_on} onChange={(e) => form.set('learned_on', e.target.value)} />
        <Textarea label="Notas (opcional)" placeholder="Conceptos clave, recursos, lo que construiste con ella…" rows={4} value={v.notes} error={form.errors.notes} onChange={(e) => form.set('notes', e.target.value)} />
        <FormActions onCancel={onClose} pending={pending} />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Level evolution chart
// ---------------------------------------------------------------------------
/** One row per day with a level change; each skill's level carries forward. */
function buildEvolution(logs: SkillLevelLog[], skillList: Skill[]) {
  const tracked = skillList.slice(0, 6);
  const ids = new Set(tracked.map((s) => s.id));
  const days = new Map<string, Map<string, number>>();
  for (const log of logs) {
    if (!ids.has(log.skill_id)) continue;
    const day = toISODate(new Date(log.logged_at));
    const levels = days.get(day) ?? new Map<string, number>();
    levels.set(log.skill_id, log.level); // logs are ordered: the last change of a day wins
    days.set(day, levels);
  }
  const current: Record<string, number> = {};
  const rows = [...days.keys()].sort().map((day) => {
    for (const [id, level] of days.get(day) as Map<string, number>) current[id] = level;
    return { label: formatDate(day, 'short'), ...current };
  });
  // Extend every line to today so a single change still draws a visible segment.
  if (rows.length > 0) rows.push({ label: 'Hoy', ...current });
  return { rows, tracked };
}

function EvolutionChart({ logs, skillList }: { logs: SkillLevelLog[]; skillList: Skill[] }) {
  const { rows, tracked } = useMemo(() => buildEvolution(logs, skillList), [logs, skillList]);
  if (rows.length === 0) return <EmptyState icon={Sparkles} title="Sin historial todavía" description="Cada vez que actualices el nivel de una habilidad, el cambio quedará registrado aquí." />;
  return (
    <div className="h-60 w-full" role="img" aria-label="Evolución del nivel de cada habilidad en el tiempo">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
          <YAxis {...axisProps} domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} />
          <Tooltip {...tooltipProps} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13 }} />
          {tracked.map((skill, i) => (
            <Line isAnimationActive={false} key={skill.id} type="stepAfter" dataKey={skill.id} name={skill.name} stroke={CHART.series[i % CHART.series.length] as string} strokeWidth={2} dot={{ r: 3 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function SkillsPage() {
  const today = todayISO();
  const [tab, setTab] = useState<Tab>('skills');
  const skillEditor = useEditor<Skill>();
  const sessionEditor = useEditor<PracticeSession>();
  const techEditor = useEditor<Technology>();

  const skillsQuery = useQuery(() => skills.list(), []);
  const logsQuery = useQuery(() => skillLevelLogs.list(), []);
  const sessionsQuery = useQuery(() => practiceSessions.list(), []);
  const projectsQuery = useQuery(() => projects.list(), []);
  const techQuery = useQuery(() => technologies.list(), []);

  const reloadSkills = () => {
    void skillsQuery.reload();
    void logsQuery.reload();
    void sessionsQuery.reload(); // sessions of a deleted skill lose their link
  };
  const reloadSessions = () => void sessionsQuery.reload();

  const skillList = useMemo(() => skillsQuery.data ?? [], [skillsQuery.data]);
  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
  const personalProjects = (projectsQuery.data ?? []).filter((p) => p.area === 'personal');

  const entries: TimedEntry[] = useMemo(() => sessions.map((s) => ({ date: s.session_date, minutes: s.duration_minutes })), [sessions]);
  const codingEntries = useMemo(() => sessions.filter((s) => s.kind === 'coding').map((s) => ({ date: s.session_date, minutes: s.duration_minutes })), [sessions]);
  const minutesBySkill = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) if (s.skill_id) map.set(s.skill_id, (map.get(s.skill_id) ?? 0) + s.duration_minutes);
    return map;
  }, [sessions]);
  const minutesByProject = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) if (s.project_id) map.set(s.project_id, (map.get(s.project_id) ?? 0) + s.duration_minutes);
    return map;
  }, [sessions]);

  const skillName = (id: string | null) => skillList.find((s) => s.id === id)?.name;
  const projectName = (id: string | null) => personalProjects.find((p) => p.id === id)?.name;

  return (
    <>
      <PageHeader
        eyebrow="Skill Development"
        title="Desarrollo profesional"
        description="Habilidades, horas de práctica, proyectos personales y tecnologías aprendidas."
        actions={
          <>
            <Button icon={<Plus className="size-4" />} onClick={skillEditor.openNew}>
              Nueva habilidad
            </Button>
            <Button variant="primary" icon={<Timer className="size-4" />} onClick={sessionEditor.openNew}>
              Registrar sesión
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Horas totales" value={formatMinutes(totalMinutes(entries))} tone="accent" />
        <Stat label="Programación este mes" value={formatMinutes(minutesBetween(codingEntries, startOfMonth(monthKeyOf(today)), today))} />
        <Stat label="Esta semana" value={formatMinutes(minutesBetween(entries, startOfWeek(today), today))} />
        <Stat label="Habilidades" value={skillList.length} />
      </div>

      <Tabs<Tab>
        label="Secciones de desarrollo"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'skills', label: 'Habilidades' },
          { value: 'sessions', label: 'Sesiones' },
          { value: 'projects', label: 'Proyectos' },
          { value: 'technologies', label: 'Tecnologías' },
        ]}
      />

      {tab === 'skills' && (
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <Panel title="Horas de práctica · últimas 8 semanas">
              <QueryView query={sessionsQuery}>{() => <HoursChart buckets={weeklyBuckets(entries, 8, today)} ariaLabel="Horas de práctica por semana durante las últimas 8 semanas" />}</QueryView>
            </Panel>
            <Panel title="Evolución de niveles">
              <QueryView query={logsQuery}>{(logs) => <EvolutionChart logs={logs} skillList={skillList} />}</QueryView>
            </Panel>
          </div>

          <QueryView query={skillsQuery}>
            {(list) =>
              list.length === 0 ? (
                <Panel>
                  <EmptyState icon={Cpu} title="Sin habilidades" description="Crea una habilidad con su nivel actual y el nivel que quieres alcanzar." />
                </Panel>
              ) : (
                CATEGORY_ORDER.filter((category) => list.some((s) => s.category === category)).map((category) => (
                  <Panel key={category} title={SKILL_CATEGORY_LABEL[category]} flush>
                    <ul className="divide-y divide-line">
                      {list
                        .filter((s) => s.category === category)
                        .map((skill) => (
                          <li key={skill.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                                <p className="font-medium">{skill.name}</p>
                                <p className="num text-sm text-ink-soft">
                                  Nivel <span className="text-ink">{skill.current_level}</span> / {skill.target_level} · {formatMinutes(minutesBySkill.get(skill.id) ?? 0)}
                                </p>
                              </div>
                              <div className="mt-2">
                                <ProgressBar percent={percentOf(skill.current_level, skill.target_level)} tone={skill.current_level >= skill.target_level ? 'ok' : 'accent'} label={`Progreso de ${skill.name}`} />
                              </div>
                              {skill.notes && <p className="mt-2 line-clamp-2 text-sm text-ink-mute">{skill.notes}</p>}
                            </div>
                            <RowActions name={skill.name} onEdit={() => skillEditor.openEdit(skill)} onDelete={() => skillEditor.askDelete(skill)} />
                          </li>
                        ))}
                    </ul>
                  </Panel>
                ))
              )
            }
          </QueryView>
        </div>
      )}

      {tab === 'sessions' && (
        <Panel title="Sesiones de práctica" flush>
          <QueryView query={sessionsQuery}>
            {(list) =>
              list.length === 0 ? (
                <EmptyState icon={Timer} title="Sin sesiones registradas" description="Registra cada sesión de estudio o programación para ver tus horas acumuladas." />
              ) : (
                <ul className="divide-y divide-line">
                  {list.map((session) => (
                    <li key={session.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="num font-medium">{formatMinutes(session.duration_minutes)}</span>
                          <Badge tone={session.kind === 'coding' ? 'accent' : 'neutral'}>{PRACTICE_KIND_LABEL[session.kind]}</Badge>
                          <span className="text-sm text-ink-soft">{formatDate(session.session_date, 'weekday')}</span>
                        </div>
                        <p className="mt-1 text-sm text-ink-mute">{[skillName(session.skill_id), projectName(session.project_id)].filter(Boolean).join(' · ') || 'Sin habilidad ni proyecto'}</p>
                        {session.notes && <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{session.notes}</p>}
                      </div>
                      <RowActions name={`sesión del ${formatDate(session.session_date)}`} onEdit={() => sessionEditor.openEdit(session)} onDelete={() => sessionEditor.askDelete(session)} />
                    </li>
                  ))}
                </ul>
              )
            }
          </QueryView>
        </Panel>
      )}

      {tab === 'projects' && (
        <ProjectsPanel
          area="personal"
          title="Proyectos personales"
          query={projectsQuery}
          emptyDescription="Documenta lo que construyes: objetivo, tecnologías y repositorio."
          onChanged={reloadSessions}
          renderMeta={(project) => (
            <p className="mt-2 text-sm text-ink-mute">
              Tiempo invertido: <span className="num text-ink-soft">{formatMinutes(minutesByProject.get(project.id) ?? 0)}</span>
            </p>
          )}
        />
      )}

      {tab === 'technologies' && (
        <Panel
          title="Tecnologías aprendidas"
          flush
          actions={
            <Button size="sm" icon={<Plus className="size-4" />} onClick={techEditor.openNew}>
              Documentar
            </Button>
          }
        >
          <QueryView query={techQuery}>
            {(list) =>
              list.length === 0 ? (
                <EmptyState icon={Cpu} title="Sin tecnologías documentadas" description="Lleva un registro de cada lenguaje, framework o herramienta que aprendes." />
              ) : (
                <ul className="divide-y divide-line">
                  {list.map((tech) => (
                    <li key={tech.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{tech.name}</p>
                          <Badge tone={PROFICIENCY_TONE[tech.proficiency]}>{PROFICIENCY_LABEL[tech.proficiency]}</Badge>
                        </div>
                        <p className="mt-0.5 text-sm text-ink-mute">
                          {SKILL_CATEGORY_LABEL[tech.category]}
                          {tech.learned_on && ` · desde ${formatDate(tech.learned_on)}`}
                        </p>
                        {tech.notes && <p className="mt-1.5 whitespace-pre-line text-sm text-ink-soft">{tech.notes}</p>}
                      </div>
                      <RowActions name={tech.name} onEdit={() => techEditor.openEdit(tech)} onDelete={() => techEditor.askDelete(tech)} />
                    </li>
                  ))}
                </ul>
              )
            }
          </QueryView>
        </Panel>
      )}

      {skillEditor.target && <SkillForm target={skillEditor.target} onClose={skillEditor.close} onSaved={reloadSkills} />}
      {sessionEditor.target && <SessionForm target={sessionEditor.target} skillList={skillList} projectList={personalProjects} onClose={sessionEditor.close} onSaved={reloadSessions} />}
      {techEditor.target && <TechnologyForm target={techEditor.target} onClose={techEditor.close} onSaved={() => void techQuery.reload()} />}
      <DeleteDialog row={skillEditor.deleting} name={(s) => s.name} remove={(s) => skills.remove(s.id)} onDone={reloadSkills} onClose={skillEditor.closeDelete} consequence="Sus sesiones se conservan sin habilidad asociada." />
      <DeleteDialog row={sessionEditor.deleting} name={(s) => `sesión del ${formatDate(s.session_date)}`} remove={(s) => practiceSessions.remove(s.id)} onDone={reloadSessions} onClose={sessionEditor.closeDelete} />
      <DeleteDialog row={techEditor.deleting} name={(t) => t.name} remove={(t) => technologies.remove(t.id)} onDone={() => void techQuery.reload()} onClose={techEditor.closeDelete} />
    </>
  );
}

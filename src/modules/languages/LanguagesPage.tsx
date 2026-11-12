import { ArrowRight, Languages as LanguagesIcon, Plus, Timer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, DeleteDialog, EmptyState, FormActions, Input, Modal, PageHeader, Panel, ProgressBar, QueryView, RowActions, Select, Stat, Tabs, Textarea, optionsFrom, useEditor, type EditorTarget } from '@/components/ui';
import { useAction } from '@/hooks/useAction';
import { useForm } from '@/hooks/useForm';
import { useQuery } from '@/hooks/useQuery';
import { cn } from '@/lib/cn';
import { formatDate, formatMinutes, monthKeyOf, startOfMonth, startOfWeek, todayISO } from '@/lib/dates';
import { CEFR_LABEL, CEFR_LEVELS, LANGUAGE_SKILL_LABEL } from '@/lib/labels';
import { percentOf } from '@/lib/money';
import { minutesBetween, monthlyBuckets, totalMinutes, weeklyBuckets, type TimedEntry } from '@/lib/sessions';
import { isoDate, maxLength, required, type Rule } from '@/lib/validation';
import { DurationFields, durationMinutes, durationRule, toDuration } from '@/modules/shared/DurationFields';
import { HoursChart } from '@/modules/shared/HoursChart';
import { languageSessions, languages } from '@/services';
import type { CefrLevel, Language, LanguageSession, LanguageSkill } from '@/types/database';

type Tab = 'overview' | 'sessions';
type Period = 'weekly' | 'monthly';

const SKILLS = Object.keys(LANGUAGE_SKILL_LABEL) as LanguageSkill[];
const SKILL_SERIES = SKILLS.map((key) => ({ key, label: LANGUAGE_SKILL_LABEL[key] }));
const TARGET_OPTIONS = CEFR_LEVELS.filter((l) => l !== 'A0').map((value) => ({ value, label: CEFR_LABEL[value] }));

const levelIndex = (level: CefrLevel) => CEFR_LEVELS.indexOf(level);

const targetAboveCurrent: Rule<{ current_level: CefrLevel; target_level: CefrLevel }> = (_v, values) =>
  levelIndex(values.target_level) < levelIndex(values.current_level) ? 'El objetivo no puede ser menor que el nivel actual' : null;

function LanguageForm({ target, onClose, onSaved }: { target: EditorTarget<Language>; onClose: () => void; onSaved: () => void }) {
  const editing = target.mode === 'edit' ? target.row : null;
  const { run, pending } = useAction();
  const form = useForm(
    {
      name: editing?.name ?? '',
      current_level: (editing?.current_level ?? 'A1') as CefrLevel,
      target_level: (editing?.target_level ?? 'B2') as CefrLevel,
      notes: editing?.notes ?? '',
    },
    { name: [required(), maxLength(60)], target_level: [targetAboveCurrent], notes: [maxLength(2000)] },
  );
  const v = form.values;

  const save = form.submit(async (values) => {
    const payload = { name: values.name.trim(), current_level: values.current_level, target_level: values.target_level as Language['target_level'], notes: values.notes.trim() };
    const ok = await run(() => (editing ? languages.update(editing.id, payload) : languages.create(payload)), editing ? 'Idioma actualizado.' : 'Idioma registrado.');
    if (ok) {
      onClose();
      onSaved();
    }
  });

  return (
    <Modal open title={editing ? 'Editar idioma' : 'Nuevo idioma'} onClose={onClose}>
      <form noValidate onSubmit={save} className="flex flex-col gap-4">
        <Input label="Idioma" placeholder="Ej. Inglés" value={v.name} error={form.errors.name} onChange={(e) => form.set('name', e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Nivel actual" value={v.current_level} options={optionsFrom(CEFR_LABEL)} onChange={(e) => form.set('current_level', e.target.value as CefrLevel)} />
          <Select label="Nivel objetivo" value={v.target_level} error={form.errors.target_level} options={TARGET_OPTIONS} onChange={(e) => form.set('target_level', e.target.value as CefrLevel)} />
        </div>
        <Textarea label="Notas (opcional)" value={v.notes} error={form.errors.notes} onChange={(e) => form.set('notes', e.target.value)} />
        <FormActions onCancel={onClose} pending={pending} />
      </form>
    </Modal>
  );
}

function SessionForm({ target, languageList, onClose, onSaved }: { target: EditorTarget<LanguageSession>; languageList: Language[]; onClose: () => void; onSaved: () => void }) {
  const editing = target.mode === 'edit' ? target.row : null;
  const { run, pending } = useAction();
  const form = useForm(
    {
      language_id: editing?.language_id ?? languageList[0]?.id ?? '',
      skill: (editing?.skill ?? 'listening') as LanguageSkill,
      session_date: editing?.session_date ?? todayISO(),
      ...toDuration(editing?.duration_minutes ?? 30),
      notes: editing?.notes ?? '',
    },
    { language_id: [required('Selecciona un idioma')], session_date: [isoDate()], hours: [durationRule], notes: [maxLength(2000)] },
  );
  const v = form.values;

  const save = form.submit(async (values) => {
    const payload = {
      language_id: values.language_id,
      skill: values.skill,
      session_date: values.session_date,
      duration_minutes: durationMinutes(values),
      notes: values.notes.trim(),
    };
    const ok = await run(() => (editing ? languageSessions.update(editing.id, payload) : languageSessions.create(payload)), editing ? 'Sesión actualizada.' : 'Sesión registrada.');
    if (ok) {
      onClose();
      onSaved();
    }
  });

  return (
    <Modal open title={editing ? 'Editar sesión' : 'Registrar sesión de idioma'} onClose={onClose}>
      <form noValidate onSubmit={save} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Idioma" value={v.language_id} error={form.errors.language_id} options={languageList.map((l) => ({ value: l.id, label: l.name }))} onChange={(e) => form.set('language_id', e.target.value)} />
          <Select label="Habilidad" value={v.skill} options={optionsFrom(LANGUAGE_SKILL_LABEL)} onChange={(e) => form.set('skill', e.target.value as LanguageSkill)} />
        </div>
        <Input label="Fecha" type="date" value={v.session_date} error={form.errors.session_date} onChange={(e) => form.set('session_date', e.target.value)} />
        <DurationFields values={v} error={form.errors.hours} onChange={(key, value) => form.set(key, value)} />
        <Textarea label="Observaciones (opcional)" placeholder="Material usado, dificultades, vocabulario nuevo…" value={v.notes} error={form.errors.notes} onChange={(e) => form.set('notes', e.target.value)} />
        <FormActions onCancel={onClose} pending={pending} />
      </form>
    </Modal>
  );
}

export default function LanguagesPage() {
  const today = todayISO();
  const [tab, setTab] = useState<Tab>('overview');
  const [period, setPeriod] = useState<Period>('weekly');
  const [languageFilter, setLanguageFilter] = useState('');
  const languageEditor = useEditor<Language>();
  const sessionEditor = useEditor<LanguageSession>();

  const languagesQuery = useQuery(() => languages.list(), []);
  const sessionsQuery = useQuery(() => languageSessions.list(), []);
  const reloadAll = () => {
    void languagesQuery.reload();
    void sessionsQuery.reload();
  };
  const reloadSessions = () => void sessionsQuery.reload();

  const languageList = useMemo(() => languagesQuery.data ?? [], [languagesQuery.data]);
  const allSessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
  const sessions = useMemo(() => (languageFilter ? allSessions.filter((s) => s.language_id === languageFilter) : allSessions), [allSessions, languageFilter]);
  const entries: TimedEntry[] = useMemo(() => sessions.map((s) => ({ date: s.session_date, minutes: s.duration_minutes, group: s.skill })), [sessions]);
  const languageName = (id: string) => languageList.find((l) => l.id === id)?.name ?? 'Idioma';

  const statsFor = (languageId: string) => {
    const own = allSessions.filter((s) => s.language_id === languageId);
    const total = own.reduce((sum, s) => sum + s.duration_minutes, 0);
    return { total, bySkill: SKILLS.map((skill) => ({ skill, minutes: own.filter((s) => s.skill === skill).reduce((sum, s) => sum + s.duration_minutes, 0) })) };
  };

  const canLog = languageList.length > 0;

  return (
    <>
      <PageHeader
        eyebrow="Language Lab"
        title="Aprendizaje de idiomas"
        description="Sesiones de listening, speaking, reading y writing con sus horas acumuladas."
        actions={
          <>
            <Button icon={<Plus className="size-4" />} onClick={languageEditor.openNew}>
              Nuevo idioma
            </Button>
            <Button variant="primary" icon={<Timer className="size-4" />} onClick={sessionEditor.openNew} disabled={!canLog} title={canLog ? undefined : 'Registra primero un idioma'}>
              Registrar sesión
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Horas acumuladas" value={formatMinutes(totalMinutes(entries))} tone="accent" />
        <Stat label="Esta semana" value={formatMinutes(minutesBetween(entries, startOfWeek(today), today))} />
        <Stat label="Este mes" value={formatMinutes(minutesBetween(entries, startOfMonth(monthKeyOf(today)), today))} />
        <Stat label="Sesiones" value={sessions.length} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Tabs<Tab>
          label="Secciones de idiomas"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'overview', label: 'Resumen' },
            { value: 'sessions', label: 'Sesiones' },
          ]}
        />
        {languageList.length > 1 && (
          <div className="mb-5 sm:w-56">
            <Select label="Filtrar por idioma" value={languageFilter} placeholder="Todos los idiomas" options={languageList.map((l) => ({ value: l.id, label: l.name }))} onChange={(e) => setLanguageFilter(e.target.value)} />
          </div>
        )}
      </div>

      {tab === 'overview' && (
        <div className="flex flex-col gap-5">
          <QueryView query={languagesQuery}>
            {(list) =>
              list.length === 0 ? (
                <Panel>
                  <EmptyState icon={LanguagesIcon} title="Sin idiomas registrados" description="Registra un idioma con tu nivel actual y el nivel que quieres alcanzar." />
                </Panel>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {list.map((language) => {
                    const stats = statsFor(language.id);
                    const span = levelIndex(language.target_level);
                    return (
                      <Panel key={language.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-lg font-semibold">{language.name}</h3>
                            <p className="num mt-1 flex items-center gap-2 text-sm">
                              <Badge tone="accent">{language.current_level}</Badge>
                              <ArrowRight className="size-3.5 text-ink-mute" aria-hidden />
                              <Badge tone="ok">{language.target_level}</Badge>
                              <span className="text-ink-soft">{formatMinutes(stats.total)}</span>
                            </p>
                          </div>
                          <RowActions name={language.name} onEdit={() => languageEditor.openEdit(language)} onDelete={() => languageEditor.askDelete(language)} />
                        </div>
                        <div className="mt-3">
                          <ProgressBar percent={percentOf(levelIndex(language.current_level), span)} tone={levelIndex(language.current_level) >= span ? 'ok' : 'accent'} label={`Avance hacia ${language.target_level} en ${language.name}`} />
                        </div>
                        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                          {stats.bySkill.map(({ skill, minutes }) => (
                            <div key={skill}>
                              <dt className="text-ink-mute">{LANGUAGE_SKILL_LABEL[skill]}</dt>
                              <dd className="num text-ink">{formatMinutes(minutes)}</dd>
                            </div>
                          ))}
                        </dl>
                        {language.notes && <p className="mt-3 line-clamp-2 text-sm text-ink-mute">{language.notes}</p>}
                      </Panel>
                    );
                  })}
                </div>
              )
            }
          </QueryView>

          <Panel
            title={period === 'weekly' ? 'Progreso semanal · últimas 8 semanas' : 'Progreso mensual · últimos 6 meses'}
            actions={
              <div className="flex rounded-lg border border-line-strong p-0.5" role="group" aria-label="Periodo del gráfico">
                {(['weekly', 'monthly'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={period === option}
                    onClick={() => setPeriod(option)}
                    className={cn('h-8 rounded-md px-3 text-sm font-medium transition-colors', period === option ? 'bg-accent text-void' : 'text-ink-soft hover:text-ink')}
                  >
                    {option === 'weekly' ? 'Semanal' : 'Mensual'}
                  </button>
                ))}
              </div>
            }
          >
            <QueryView query={sessionsQuery}>
              {() => (
                <HoursChart
                  buckets={period === 'weekly' ? weeklyBuckets(entries, 8, today) : monthlyBuckets(entries, 6, today)}
                  series={SKILL_SERIES}
                  ariaLabel={`Horas de estudio por habilidad, vista ${period === 'weekly' ? 'semanal' : 'mensual'}`}
                />
              )}
            </QueryView>
          </Panel>
        </div>
      )}

      {tab === 'sessions' && (
        <Panel title="Sesiones registradas" flush>
          <QueryView query={sessionsQuery}>
            {() =>
              sessions.length === 0 ? (
                <EmptyState icon={Timer} title="Sin sesiones registradas" description={canLog ? 'Registra tu primera sesión de práctica.' : 'Registra primero un idioma para empezar a anotar sesiones.'} />
              ) : (
                <ul className="divide-y divide-line">
                  {sessions.map((session) => (
                    <li key={session.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="num font-medium">{formatMinutes(session.duration_minutes)}</span>
                          <Badge tone="accent">{LANGUAGE_SKILL_LABEL[session.skill]}</Badge>
                          <span className="text-sm text-ink-soft">
                            {languageName(session.language_id)} · {formatDate(session.session_date, 'weekday')}
                          </span>
                        </div>
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

      {languageEditor.target && <LanguageForm target={languageEditor.target} onClose={languageEditor.close} onSaved={reloadAll} />}
      {sessionEditor.target && <SessionForm target={sessionEditor.target} languageList={languageList} onClose={sessionEditor.close} onSaved={reloadSessions} />}
      <DeleteDialog row={languageEditor.deleting} name={(l) => l.name} remove={(l) => languages.remove(l.id)} onDone={reloadAll} onClose={languageEditor.closeDelete} consequence="También se eliminarán todas sus sesiones." />
      <DeleteDialog row={sessionEditor.deleting} name={(s) => `sesión del ${formatDate(s.session_date)}`} remove={(s) => languageSessions.remove(s.id)} onDone={reloadSessions} onClose={sessionEditor.closeDelete} />
    </>
  );
}

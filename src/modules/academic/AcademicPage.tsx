import { Check, ClipboardList, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, DeleteDialog, EmptyState, FormActions, Input, Modal, PageHeader, Panel, ProgressBar, QueryView, RowActions, Select, Stat, Tabs, Textarea, optionsFrom, useEditor, type EditorTarget } from '@/components/ui';
import { useAction } from '@/hooks/useAction';
import { useForm } from '@/hooks/useForm';
import { useQuery } from '@/hooks/useQuery';
import { cn } from '@/lib/cn';
import { addDays, formatDate, relativeDay, todayISO } from '@/lib/dates';
import { PRIORITY_LABEL, PRIORITY_RANK, PRIORITY_TONE, TASK_STATUS_LABEL } from '@/lib/labels';
import { percentOf } from '@/lib/money';
import { isoDate, maxLength, required } from '@/lib/validation';
import { ProjectsPanel } from '@/modules/shared/ProjectsPanel';
import { academicTasks, projects } from '@/services';
import type { AcademicTask, Project, TaskPriority, TaskStatus } from '@/types/database';

type Tab = 'tasks' | 'projects';
type Filter = 'open' | 'overdue' | 'completed' | 'all';

const isOverdue = (task: AcademicTask, today: string) => task.status !== 'completed' && task.due_date < today;

/** completed_at must be set exactly when the status is "completed" (DB constraint). */
const statusPatch = (status: TaskStatus, previous?: AcademicTask) => ({
  status,
  completed_at: status === 'completed' ? (previous?.completed_at ?? new Date().toISOString()) : null,
});

function TaskForm({ target, projectList, onClose, onSaved }: { target: EditorTarget<AcademicTask>; projectList: Project[]; onClose: () => void; onSaved: () => void }) {
  const editing = target.mode === 'edit' ? target.row : null;
  const { run, pending } = useAction();
  const form = useForm(
    {
      title: editing?.title ?? '',
      description: editing?.description ?? '',
      course: editing?.course ?? '',
      project_id: editing?.project_id ?? '',
      due_date: editing?.due_date ?? addDays(todayISO(), 7),
      priority: (editing?.priority ?? 'medium') as TaskPriority,
      status: (editing?.status ?? 'pending') as TaskStatus,
    },
    { title: [required(), maxLength(160)], description: [maxLength(4000)], course: [maxLength(120)], due_date: [isoDate()] },
  );
  const v = form.values;

  const save = form.submit(async (values) => {
    const payload = {
      title: values.title.trim(),
      description: values.description.trim(),
      course: values.course.trim(),
      project_id: values.project_id || null,
      due_date: values.due_date,
      priority: values.priority,
      ...statusPatch(values.status, editing ?? undefined),
    };
    const ok = await run(() => (editing ? academicTasks.update(editing.id, payload) : academicTasks.create(payload)), editing ? 'Actividad actualizada.' : 'Actividad creada.');
    if (ok) {
      onClose();
      onSaved();
    }
  });

  return (
    <Modal open title={editing ? 'Editar actividad' : 'Nueva actividad'} onClose={onClose}>
      <form noValidate onSubmit={save} className="flex flex-col gap-4">
        <Input label="Título" placeholder="Ej. Evidencia de aprendizaje GA4" value={v.title} error={form.errors.title} onChange={(e) => form.set('title', e.target.value)} />
        <Textarea label="Descripción (opcional)" value={v.description} error={form.errors.description} onChange={(e) => form.set('description', e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Competencia o materia (opcional)" value={v.course} error={form.errors.course} onChange={(e) => form.set('course', e.target.value)} />
          <Select label="Proyecto (opcional)" value={v.project_id} placeholder="Sin proyecto" options={projectList.map((p) => ({ value: p.id, label: p.name }))} onChange={(e) => form.set('project_id', e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Fecha límite" type="date" value={v.due_date} error={form.errors.due_date} onChange={(e) => form.set('due_date', e.target.value)} />
          <Select label="Prioridad" value={v.priority} options={optionsFrom(PRIORITY_LABEL)} onChange={(e) => form.set('priority', e.target.value as TaskPriority)} />
          <Select label="Estado" value={v.status} options={optionsFrom(TASK_STATUS_LABEL)} onChange={(e) => form.set('status', e.target.value as TaskStatus)} />
        </div>
        <FormActions onCancel={onClose} pending={pending} />
      </form>
    </Modal>
  );
}

export default function AcademicPage() {
  const today = todayISO();
  const [tab, setTab] = useState<Tab>('tasks');
  const [filter, setFilter] = useState<Filter>('open');
  const editor = useEditor<AcademicTask>();
  const { run, pending } = useAction();

  const tasksQuery = useQuery(() => academicTasks.list(), []);
  const projectsQuery = useQuery(() => projects.list(), []);
  const reload = () => void tasksQuery.reload();

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const academicProjects = (projectsQuery.data ?? []).filter((p) => p.area === 'academic');
  const projectName = (id: string | null) => academicProjects.find((p) => p.id === id)?.name;

  const counts = useMemo(() => {
    const open = tasks.filter((t) => t.status !== 'completed');
    return {
      open: open.length,
      overdue: open.filter((t) => t.due_date < today).length,
      week: open.filter((t) => t.due_date >= today && t.due_date <= addDays(today, 7)).length,
      completed: tasks.length - open.length,
    };
  }, [tasks, today]);

  const visible = useMemo(() => {
    const list = tasks.filter((t) => {
      if (filter === 'open') return t.status !== 'completed';
      if (filter === 'overdue') return isOverdue(t, today);
      if (filter === 'completed') return t.status === 'completed';
      return true;
    });
    return [...list].sort((a, b) => a.due_date.localeCompare(b.due_date) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  }, [tasks, filter, today]);

  const toggle = (task: AcademicTask) => {
    const next: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';
    void run(() => academicTasks.update(task.id, statusPatch(next)), next === 'completed' ? 'Actividad completada.' : 'Actividad reabierta.').then((ok) => ok && reload());
  };

  const FILTERS: { value: Filter; label: string }[] = [
    { value: 'open', label: `Pendientes (${counts.open})` },
    { value: 'overdue', label: `Atrasadas (${counts.overdue})` },
    { value: 'completed', label: `Completadas (${counts.completed})` },
    { value: 'all', label: 'Todas' },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Academic Center"
        title="Formación SENA"
        description="Actividades, evidencias y proyectos con sus fechas límite."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={editor.openNew}>
            Nueva actividad
          </Button>
        }
      />
      <Tabs<Tab>
        label="Secciones académicas"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'tasks', label: 'Actividades' },
          { value: 'projects', label: 'Proyectos' },
        ]}
      />

      {tab === 'tasks' && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Pendientes" value={counts.open} />
            <Stat label="Atrasadas" value={counts.overdue} tone={counts.overdue > 0 ? 'danger' : 'default'} />
            <Stat label="Próximos 7 días" value={counts.week} tone="accent" />
            <Stat label="Completadas" value={counts.completed} tone="ok" />
          </div>

          <Panel flush>
            <div className="flex gap-1.5 overflow-x-auto border-b border-line px-3 py-2.5 sm:px-5" role="group" aria-label="Filtrar actividades">
              {FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={filter === option.value}
                  onClick={() => setFilter(option.value)}
                  className={cn(
                    'h-9 whitespace-nowrap rounded-lg border px-3 text-sm font-medium transition-colors',
                    filter === option.value ? 'border-accent/60 bg-accent/10 text-accent' : 'border-transparent text-ink-mute hover:text-ink',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <QueryView query={tasksQuery}>
              {() =>
                visible.length === 0 ? (
                  <EmptyState
                    icon={ClipboardList}
                    title={tasks.length === 0 ? 'Sin actividades registradas' : 'Nada en este filtro'}
                    description={tasks.length === 0 ? 'Crea tu primera actividad con su fecha límite y prioridad.' : 'Cambia el filtro para ver otras actividades.'}
                  />
                ) : (
                  <ul className="divide-y divide-line">
                    {visible.map((task) => {
                      const done = task.status === 'completed';
                      const overdue = isOverdue(task, today);
                      return (
                        <li key={task.id} className="flex items-start gap-3 px-3 py-3.5 sm:px-5">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={done}
                            aria-label={`Marcar "${task.title}" como ${done ? 'pendiente' : 'completada'}`}
                            disabled={pending}
                            onClick={() => toggle(task)}
                            className={cn(
                              'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors',
                              done ? 'border-ok bg-ok/15 text-ok' : 'border-line-strong text-transparent hover:border-accent',
                            )}
                          >
                            <Check className="size-4" strokeWidth={3} />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={cn('font-medium', done && 'text-ink-mute line-through')}>{task.title}</p>
                            {task.description && <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-sm text-ink-soft">{task.description}</p>}
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                              <span className={cn('num', overdue ? 'text-danger' : 'text-ink-soft')}>
                                {formatDate(task.due_date)} · {done ? 'Completada' : relativeDay(task.due_date, today)}
                              </span>
                              <Badge tone={PRIORITY_TONE[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge>
                              {overdue && <Badge tone="danger">Atrasada</Badge>}
                              {task.status === 'in_progress' && <Badge tone="accent">En progreso</Badge>}
                              {task.course && <span className="text-ink-mute">{task.course}</span>}
                              {projectName(task.project_id) && <span className="text-ink-mute">▸ {projectName(task.project_id)}</span>}
                            </div>
                          </div>
                          <RowActions name={task.title} onEdit={() => editor.openEdit(task)} onDelete={() => editor.askDelete(task)} />
                        </li>
                      );
                    })}
                  </ul>
                )
              }
            </QueryView>
          </Panel>
        </div>
      )}

      {tab === 'projects' && (
        <ProjectsPanel
          area="academic"
          title="Proyectos formativos"
          query={projectsQuery}
          emptyDescription="Agrupa las actividades de un proyecto formativo para ver su avance."
          onChanged={reload}
          renderMeta={(project) => {
            const own = tasks.filter((t) => t.project_id === project.id);
            if (own.length === 0) return <p className="mt-2 text-sm text-ink-mute">Sin actividades asociadas.</p>;
            const done = own.filter((t) => t.status === 'completed').length;
            return (
              <div className="mt-3 max-w-md">
                <div className="mb-1.5 flex justify-between text-sm text-ink-soft">
                  <span>Actividades</span>
                  <span className="num">
                    {done}/{own.length}
                  </span>
                </div>
                <ProgressBar percent={percentOf(done, own.length)} tone="ok" label={`Avance de ${project.name}`} />
              </div>
            );
          }}
        />
      )}

      {editor.target && <TaskForm target={editor.target} projectList={academicProjects} onClose={editor.close} onSaved={reload} />}
      <DeleteDialog row={editor.deleting} name={(t) => t.title} remove={(t) => academicTasks.remove(t.id)} onDone={reload} onClose={editor.closeDelete} />
    </>
  );
}

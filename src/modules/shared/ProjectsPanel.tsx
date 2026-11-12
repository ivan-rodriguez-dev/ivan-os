import { ExternalLink, FolderKanban, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge, Button, DeleteDialog, EmptyState, FormActions, Input, Modal, Panel, QueryView, RowActions, Select, Textarea, optionsFrom, useEditor, type EditorTarget } from '@/components/ui';
import { useAction } from '@/hooks/useAction';
import { useForm } from '@/hooks/useForm';
import type { QueryState } from '@/hooks/useQuery';
import { formatDate } from '@/lib/dates';
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_TONE } from '@/lib/labels';
import { isoDate, maxLength, required, url } from '@/lib/validation';
import { projects } from '@/services';
import type { Project, ProjectArea, ProjectStatus } from '@/types/database';

const parseTechnologies = (text: string): string[] => [...new Set(text.split(',').map((t) => t.trim()).filter(Boolean))].slice(0, 20);

function ProjectForm({ target, area, onClose, onSaved }: { target: EditorTarget<Project>; area: ProjectArea; onClose: () => void; onSaved: () => void }) {
  const editing = target.mode === 'edit' ? target.row : null;
  const { run, pending } = useAction();
  const form = useForm(
    {
      name: editing?.name ?? '',
      description: editing?.description ?? '',
      status: (editing?.status ?? 'active') as ProjectStatus,
      technologies: editing?.technologies.join(', ') ?? '',
      repo_url: editing?.repo_url ?? '',
      due_date: editing?.due_date ?? '',
    },
    { name: [required(), maxLength(120)], description: [maxLength(2000)], technologies: [maxLength(400)], repo_url: [url()], due_date: [isoDate(true)] },
  );
  const v = form.values;

  const save = form.submit(async (values) => {
    const payload = {
      name: values.name.trim(),
      description: values.description.trim(),
      status: values.status,
      technologies: parseTechnologies(values.technologies),
      repo_url: values.repo_url.trim(),
      due_date: values.due_date || null,
      area,
    };
    const ok = await run(() => (editing ? projects.update(editing.id, payload) : projects.create(payload)), editing ? 'Proyecto actualizado.' : 'Proyecto creado.');
    if (ok) {
      onClose();
      onSaved();
    }
  });

  return (
    <Modal open title={editing ? 'Editar proyecto' : 'Nuevo proyecto'} onClose={onClose}>
      <form noValidate onSubmit={save} className="flex flex-col gap-4">
        <Input label="Nombre" value={v.name} error={form.errors.name} onChange={(e) => form.set('name', e.target.value)} />
        <Textarea label="Descripción (opcional)" value={v.description} error={form.errors.description} onChange={(e) => form.set('description', e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Estado" value={v.status} options={optionsFrom(PROJECT_STATUS_LABEL)} onChange={(e) => form.set('status', e.target.value as ProjectStatus)} />
          <Input label="Fecha límite (opcional)" type="date" value={v.due_date} error={form.errors.due_date} onChange={(e) => form.set('due_date', e.target.value)} />
        </div>
        <Input label="Tecnologías (opcional)" hint="Separadas por comas." placeholder="React, TypeScript, PostgreSQL" value={v.technologies} error={form.errors.technologies} onChange={(e) => form.set('technologies', e.target.value)} />
        <Input label="Repositorio o enlace (opcional)" type="url" placeholder="https://" value={v.repo_url} error={form.errors.repo_url} onChange={(e) => form.set('repo_url', e.target.value)} />
        <FormActions onCancel={onClose} pending={pending} />
      </form>
    </Modal>
  );
}

interface Props {
  area: ProjectArea;
  title: string;
  query: QueryState<Project[]>;
  emptyDescription: string;
  /** Extra line under each project (task progress, logged hours…). */
  renderMeta?: (project: Project) => ReactNode;
  onChanged?: () => void;
}

export function ProjectsPanel({ area, title, query, emptyDescription, renderMeta, onChanged }: Props) {
  const editor = useEditor<Project>();
  const reload = () => {
    void query.reload();
    onChanged?.();
  };

  return (
    <Panel
      title={title}
      flush
      actions={
        <Button size="sm" icon={<Plus className="size-4" />} onClick={editor.openNew}>
          Nuevo proyecto
        </Button>
      }
    >
      <QueryView query={query}>
        {(all) => {
          const list = all.filter((p) => p.area === area);
          if (list.length === 0) return <EmptyState icon={FolderKanban} title="Sin proyectos" description={emptyDescription} />;
          return (
            <ul className="divide-y divide-line">
              {list.map((project) => (
                <li key={project.id} className="flex items-start gap-3 px-4 py-4 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{project.name}</p>
                      <Badge tone={PROJECT_STATUS_TONE[project.status]}>{PROJECT_STATUS_LABEL[project.status]}</Badge>
                    </div>
                    {project.description && <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{project.description}</p>}
                    {project.technologies.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {project.technologies.map((tech) => (
                          <span key={tech} className="num rounded-md bg-raised px-2 py-0.5 text-xs text-ink-soft">
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-mute">
                      {project.due_date && <span>Entrega: {formatDate(project.due_date)}</span>}
                      {project.repo_url && (
                        <a href={project.repo_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-accent hover:underline">
                          <ExternalLink className="size-3.5" aria-hidden />
                          Abrir enlace
                        </a>
                      )}
                    </div>
                    {renderMeta?.(project)}
                  </div>
                  <RowActions name={project.name} onEdit={() => editor.openEdit(project)} onDelete={() => editor.askDelete(project)} />
                </li>
              ))}
            </ul>
          );
        }}
      </QueryView>
      {editor.target && <ProjectForm target={editor.target} area={area} onClose={editor.close} onSaved={reload} />}
      <DeleteDialog
        row={editor.deleting}
        name={(p) => p.name}
        remove={(p) => projects.remove(p.id)}
        onDone={reload}
        onClose={editor.closeDelete}
        consequence="Las actividades y sesiones asociadas se conservan sin proyecto."
      />
    </Panel>
  );
}

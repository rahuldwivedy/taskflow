'use client';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import api from '@/lib/api';
import { Task } from '@/types';
import { useSocketEvents } from '@/hooks/useSocketEvents';
import { format, isPast } from 'date-fns';
import Link from 'next/link';
import { CheckSquare, AlertCircle, Calendar } from 'lucide-react';
import clsx from 'clsx';

const statusLabel: Record<string, string> = { TODO: 'To Do', IN_PROGRESS: 'In Progress', DONE: 'Done' };
const statusCls: Record<string, string>   = { TODO: 'badge-todo', IN_PROGRESS: 'badge-in-progress', DONE: 'badge-done' };
const priorityCls: Record<string, string> = { LOW: 'badge-low', MEDIUM: 'badge-medium', HIGH: 'badge-high' };

const GROUPS = [
  { key: 'TODO',        label: 'To Do' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'DONE',        label: 'Done' },
];

export default function AssignedPage() {
  const [tasks, setTasks]     = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const load = () => {
    api.get('/me/assigned')
      .then(({ data }) => setTasks(data))
      .catch(() => setError('Failed to load assigned tasks'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Live update when a task is assigned or updated
  useSocketEvents({
    'assigned:updated': load,
    'task:updated':     load,
    'task:deleted':     load,
  });

  return (
    <AppShell>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <CheckSquare className="w-6 h-6 text-brand-500" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Assigned to me</h1>
            <p className="text-sm text-slate-500 mt-0.5">Tasks across all your projects</p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />Loading…
          </div>
        )}
        {error && <p className="text-red-600 text-sm">{error}</p>}

        {!loading && tasks.length === 0 && (
          <div className="text-center py-20">
            <CheckSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No tasks assigned to you</p>
            <p className="text-slate-400 text-sm mt-1">When someone assigns you a task, it will appear here.</p>
          </div>
        )}

        {!loading && tasks.length > 0 && (
          <div className="space-y-8">
            {GROUPS.map(({ key, label }) => {
              const grouped = tasks.filter(t => t.status === key);
              if (grouped.length === 0) return null;
              return (
                <div key={key}>
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    {label} · {grouped.length}
                  </h2>
                  <div className="card overflow-hidden">
                    {grouped.map((task, i) => {
                      const duePast = task.dueDate && task.status !== 'DONE' && isPast(new Date(task.dueDate));
                      return (
                        <div
                          key={task.id}
                          className={clsx(
                            'flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors',
                            i < grouped.length - 1 && 'border-b border-slate-100',
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
                            {task.project && (
                              <Link
                                href={`/projects/${(task as any).project.id}/board`}
                                className="text-xs text-brand-500 hover:underline"
                                onClick={e => e.stopPropagation()}
                              >
                                {(task as any).project.name}
                              </Link>
                            )}
                          </div>

                          <span className={priorityCls[task.priority]}>
                            {task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}
                          </span>

                          {task.dueDate && (
                            <span className={clsx('flex items-center gap-1 text-xs', duePast ? 'text-red-500' : 'text-slate-400')}>
                              {duePast ? <AlertCircle className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
                              {format(new Date(task.dueDate), 'MMM d')}
                            </span>
                          )}

                          <span className={statusCls[task.status]}>{statusLabel[task.status]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

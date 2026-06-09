'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { Task, ProjectMember, PaginatedTasks } from '@/types';
import { TaskModal } from '@/components/tasks/TaskModal';
import { useSocketEvents } from '@/hooks/useSocketEvents';
import { useAuthStore } from '@/store/auth';
import { Plus, ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';

const statusLabel: Record<string, string> = { TODO: 'To Do', IN_PROGRESS: 'In Progress', DONE: 'Done' };
const statusCls: Record<string, string>   = { TODO: 'badge-todo', IN_PROGRESS: 'badge-in-progress', DONE: 'badge-done' };
const priorityCls: Record<string, string> = { LOW: 'badge-low', MEDIUM: 'badge-medium', HIGH: 'badge-high' };

export default function BacklogPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { user } = useAuthStore();

  const [result, setResult] = useState<PaginatedTasks>({ tasks: [], total: 0, page: 1, limit: 20, pages: 1 });
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch]       = useState('');
  const [status, setStatus]       = useState('');
  const [priority, setPriority]   = useState('');
  const [assigneeId, setAssignee] = useState('');
  const [sort, setSort]           = useState('createdAt');
  const [order, setOrder]         = useState('desc');
  const [page, setPage]           = useState(1);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [myRole, setMyRole] = useState('MEMBER');

  const load = useCallback(() => {
    setLoading(true);
    const params: any = { page, limit: 20, sort, order };
    if (search)    params.search     = search;
    if (status)    params.status     = status;
    if (priority)  params.priority   = priority;
    if (assigneeId)params.assigneeId = assigneeId;

    api.get(`/projects/${projectId}/tasks`, { params })
      .then(({ data }) => setResult(data))
      .catch(() => setError('Failed to load tasks'))
      .finally(() => setLoading(false));
  }, [projectId, page, search, status, priority, assigneeId, sort, order]);

  useEffect(() => {
    api.get(`/projects/${projectId}`).then(({ data }) => {
      setMembers(data.members ?? []);
      const me = (data.members ?? []).find((m: ProjectMember) => m.userId === user?.id);
      if (me) setMyRole(me.role);
    });
  }, [projectId, user?.id]);

  useEffect(() => { load(); }, [load]);

  // Reset to page 1 on filter change
  useEffect(() => { setPage(1); }, [search, status, priority, assigneeId, sort, order]);

  useSocketEvents({
    'task:created': () => load(),
    'task:updated': () => load(),
    'task:deleted': () => load(),
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search tasks…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select className="input w-36" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="TODO">To Do</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="DONE">Done</option>
        </select>

        <select className="input w-36" value={priority} onChange={e => setPriority(e.target.value)}>
          <option value="">All priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>

        <select className="input w-40" value={assigneeId} onChange={e => setAssignee(e.target.value)}>
          <option value="">All assignees</option>
          {members.map(m => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}
        </select>

        <div className="flex items-center gap-2 ml-auto">
          <select className="input w-36" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="createdAt">Created date</option>
            <option value="dueDate">Due date</option>
            <option value="priority">Priority</option>
          </select>
          <select className="input w-28" value={order} onChange={e => setOrder(e.target.value)}>
            <option value="desc">Newest</option>
            <option value="asc">Oldest</option>
          </select>
          <button onClick={() => { setSelectedTask(null); setModalOpen(true); }} className="btn-primary flex items-center gap-1.5 whitespace-nowrap">
            <Plus className="w-4 h-4" /> New task
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-400 font-medium uppercase tracking-wide">
              <th className="text-left px-4 py-3 w-1/2">Title</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Priority</th>
              <th className="text-left px-4 py-3">Assignee</th>
              <th className="text-left px-4 py-3">Due</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />Loading…
                </div>
              </td></tr>
            )}
            {!loading && result.tasks.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">No tasks found.</td></tr>
            )}
            {!loading && result.tasks.map(task => (
              <tr
                key={task.id}
                onClick={() => { setSelectedTask(task); setModalOpen(true); }}
                className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 font-medium text-slate-800">{task.title}</td>
                <td className="px-4 py-3"><span className={statusCls[task.status]}>{statusLabel[task.status]}</span></td>
                <td className="px-4 py-3"><span className={priorityCls[task.priority]}>{task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}</span></td>
                <td className="px-4 py-3 text-slate-500">{task.assignee?.name ?? <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3 text-slate-400">{task.dueDate ? format(new Date(task.dueDate), 'MMM d, yyyy') : <span className="text-slate-300">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {result.pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <span>{result.total} tasks — page {result.page} of {result.pages}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary py-1.5 px-2.5 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(result.pages, p + 1))}
              disabled={page === result.pages}
              className="btn-secondary py-1.5 px-2.5 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {modalOpen && (
        <TaskModal
          projectId={projectId}
          members={members}
          task={selectedTask}
          currentUserId={user?.id ?? ''}
          currentUserRole={myRole}
          onClose={() => { setModalOpen(false); setSelectedTask(null); }}
          onSaved={() => load()}
          onDeleted={() => { load(); setModalOpen(false); setSelectedTask(null); }}
        />
      )}
    </div>
  );
}

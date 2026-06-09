'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { Task, Project, ProjectMember } from '@/types';
import { TaskCard } from '@/components/board/TaskCard';
import { TaskModal } from '@/components/tasks/TaskModal';
import { useSocketEvents } from '@/hooks/useSocketEvents';
import { useAuthStore } from '@/store/auth';
import { Plus, WifiOff } from 'lucide-react';
import { getSocket } from '@/lib/socket';

const COLUMNS = [
  { status: 'TODO',        label: 'To Do',       color: 'bg-slate-100',  dot: 'bg-slate-400' },
  { status: 'IN_PROGRESS', label: 'In Progress',  color: 'bg-blue-50',   dot: 'bg-blue-500' },
  { status: 'DONE',        label: 'Done',         color: 'bg-green-50',  dot: 'bg-green-500' },
];

export default function BoardPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { user } = useAuthStore();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [socketConnected, setSocketConnected] = useState(true);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [newTaskStatus, setNewTaskStatus] = useState('TODO');

  const loadBoard = useCallback(() => {
    return Promise.all([
      api.get(`/projects/${projectId}`),
      api.get(`/projects/${projectId}/tasks`, { params: { limit: 200 } }),
    ])
      .then(([pRes, tRes]) => {
        setProject(pRes.data);
        setMembers(pRes.data.members ?? []);
        setTasks(tRes.data.tasks);
      })
      .catch(() => setError('Failed to load board'))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  // Track socket connection for the "offline" banner
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onDisconnect = () => setSocketConnected(false);
    const onConnect = () => { setSocketConnected(true); loadBoard(); }; // re-fetch on reconnect
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => { socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); };
  }, [loadBoard]);

  // Live updates via WebSocket
  useSocketEvents({
    'task:created': (task: Task) => {
      setTasks(prev => prev.some(t => t.id === task.id) ? prev : [...prev, task]);
    },
    'task:updated': (task: Task) => {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
      // If modal is open for this task, refresh it
      setSelectedTask(prev => prev?.id === task.id ? task : prev);
    },
    'task:deleted': ({ taskId }: { taskId: string }) => {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      if (selectedTask?.id === taskId) { setModalOpen(false); setSelectedTask(null); }
    },
    'member:removed': () => {
      // Reload project to get fresh member list
      api.get(`/projects/${projectId}`).then(({ data }) => {
        setProject(data);
        setMembers(data.members ?? []);
      });
    },
  });

  const openCreate = (status: string) => {
    setSelectedTask(null);
    setNewTaskStatus(status);
    setModalOpen(true);
  };

  const openEdit = (task: Task) => {
    setSelectedTask(task);
    setModalOpen(true);
  };

  const myRole = members.find(m => m.userId === user?.id)?.role ?? 'MEMBER';

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-2 text-slate-400 text-sm">
      <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      Loading board…
    </div>
  );

  if (error) return <div className="p-8 text-red-600 text-sm">{error}</div>;

  return (
    <div className="p-6 h-full">
      {!socketConnected && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          <WifiOff className="w-3.5 h-3.5" />
          Live updates paused — reconnecting…
        </div>
      )}

      {/* Board columns */}
      <div className="flex gap-4 h-full overflow-x-auto pb-4">
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.status);
          return (
            <div key={col.status} className="flex flex-col w-72 shrink-0">
              {/* Column header */}
              <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-lg ${col.color} border border-b-0 border-slate-200`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className="text-sm font-semibold text-slate-700">{col.label}</span>
                  <span className="text-xs text-slate-400 bg-white rounded-full px-1.5 py-0.5 border border-slate-200">{colTasks.length}</span>
                </div>
                <button
                  onClick={() => openCreate(col.status)}
                  className="text-slate-400 hover:text-brand-500 transition-colors"
                  title={`Add task to ${col.label}`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Cards */}
              <div className={`flex-1 flex flex-col gap-2.5 p-2.5 min-h-[200px] border border-slate-200 rounded-b-lg ${col.color} overflow-y-auto`}>
                {colTasks.map(task => (
                  <TaskCard key={task.id} task={task} onClick={() => openEdit(task)} />
                ))}
                {colTasks.length === 0 && (
                  <button
                    onClick={() => openCreate(col.status)}
                    className="flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 border border-dashed border-slate-300 rounded-lg py-3 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add task
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <TaskModal
          projectId={projectId}
          members={members}
          task={selectedTask}
          initialStatus={newTaskStatus}
          currentUserId={user?.id ?? ''}
          currentUserRole={myRole}
          onClose={() => { setModalOpen(false); setSelectedTask(null); }}
          onSaved={saved => {
            setTasks(prev =>
              prev.some(t => t.id === saved.id)
                ? prev.map(t => t.id === saved.id ? saved : t)
                : [...prev, saved]
            );
          }}
          onDeleted={taskId => setTasks(prev => prev.filter(t => t.id !== taskId))}
        />
      )}
    </div>
  );
}

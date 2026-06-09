'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { ActivityLog } from '@/types';
import { useSocketEvents } from '@/hooks/useSocketEvents';
import { formatDistanceToNow } from 'date-fns';
import { Activity } from 'lucide-react';

const eventLabels: Record<string, (p: any) => string> = {
  TASK_CREATED:   p => `created task "${p.title}"`,
  TASK_MOVED:     p => `moved "${p.title}" · ${fmtStatus(p.from)} → ${fmtStatus(p.to)}`,
  TASK_ASSIGNED:  p => `assigned "${p.title}"`,
  MEMBER_INVITED: p => `invited ${p.name} to the project`,
  MEMBER_REMOVED: p => `removed ${p.name} from the project`,
  COMMENT_ADDED:  p => `commented on a task`,
};

const eventDot: Record<string, string> = {
  TASK_CREATED:   'bg-green-400',
  TASK_MOVED:     'bg-blue-400',
  TASK_ASSIGNED:  'bg-purple-400',
  MEMBER_INVITED: 'bg-yellow-400',
  MEMBER_REMOVED: 'bg-red-400',
  COMMENT_ADDED:  'bg-slate-400',
};

function fmtStatus(s: string) {
  return { TODO: 'To Do', IN_PROGRESS: 'In Progress', DONE: 'Done' }[s] ?? s;
}

export default function ActivityPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [logs, setLogs]     = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  const load = () => {
    api.get(`/projects/${projectId}/activity`)
      .then(({ data }) => setLogs(data.logs))
      .catch(() => setError('Failed to load activity'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [projectId]);

  // Live: refresh on any project event
  useSocketEvents({
    'task:created': load,
    'task:updated': load,
    'task:deleted': load,
    'comment:added': load,
    'member:removed': load,
  });

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="w-5 h-5 text-slate-400" />
        <h2 className="text-lg font-semibold text-slate-800">Activity log</h2>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />Loading…
        </div>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && logs.length === 0 && (
        <p className="text-slate-400 text-sm">No activity yet.</p>
      )}

      {!loading && logs.length > 0 && (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-200" />

          <div className="space-y-0">
            {logs.map((log, i) => (
              <div key={log.id} className="relative flex gap-4 pl-8 pb-5">
                {/* Dot */}
                <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-2 border-white ${eventDot[log.eventType] ?? 'bg-slate-300'} flex items-center justify-center z-10`} />

                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">{log.actor.name}</span>{' '}
                    {(eventLabels[log.eventType]?.(log.payload)) ?? log.eventType}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

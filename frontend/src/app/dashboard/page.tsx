'use client';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { ActivityLog } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { LayoutDashboard, FolderOpen, CheckSquare, TrendingUp, Activity } from 'lucide-react';
import Link from 'next/link';

interface DashboardData {
  projectCount: number;
  tasksByStatus: Record<string, number>;
  completedThisWeek: number;
  busiestProject: { id: string; name: string } | null;
  recentActivity: ActivityLog[];
}

function ActivityEventLabel({ log }: { log: ActivityLog }) {
  const map: Record<string, string> = {
    TASK_CREATED: `created task "${log.payload?.title}"`,
    TASK_MOVED: `moved "${log.payload?.title}" from ${log.payload?.from} to ${log.payload?.to}`,
    TASK_ASSIGNED: `assigned "${log.payload?.title}"`,
    MEMBER_INVITED: `invited ${log.payload?.name}`,
    MEMBER_REMOVED: `removed ${log.payload?.name}`,
    COMMENT_ADDED: `commented on a task`,
  };
  return <span>{map[log.eventType] || log.eventType}</span>;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard')
      .then(({ data }) => setData(data))
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">
            Good {getGreeting()}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Here's what's happening across your projects.</p>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            Loading…
          </div>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}

        {data && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard
                icon={<FolderOpen className="w-5 h-5 text-brand-500" />}
                label="Projects"
                value={data.projectCount}
                bg="bg-brand-50"
              />
              <StatCard
                icon={<CheckSquare className="w-5 h-5 text-green-500" />}
                label="Completed this week"
                value={data.completedThisWeek}
                bg="bg-green-50"
              />
              <StatCard
                icon={<LayoutDashboard className="w-5 h-5 text-yellow-500" />}
                label="In progress"
                value={data.tasksByStatus?.IN_PROGRESS || 0}
                bg="bg-yellow-50"
              />
              <StatCard
                icon={<TrendingUp className="w-5 h-5 text-purple-500" />}
                label="To do"
                value={data.tasksByStatus?.TODO || 0}
                bg="bg-purple-50"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Tasks by status */}
              <div className="card p-5 lg:col-span-1">
                <h2 className="text-sm font-semibold text-slate-700 mb-4">My tasks by status</h2>
                <div className="space-y-3">
                  {[
                    { label: 'To Do', key: 'TODO', color: 'bg-slate-400' },
                    { label: 'In Progress', key: 'IN_PROGRESS', color: 'bg-blue-500' },
                    { label: 'Done', key: 'DONE', color: 'bg-green-500' },
                  ].map(({ label, key, color }) => {
                    const val = data.tasksByStatus?.[key] || 0;
                    const total = Object.values(data.tasksByStatus || {}).reduce((a, b) => a + b, 0);
                    const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                    return (
                      <div key={key}>
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>{label}</span>
                          <span>{val}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full">
                          <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {data.busiestProject && (
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-500 mb-1">Most open tasks</p>
                    <Link
                      href={`/projects/${data.busiestProject.id}/board`}
                      className="text-sm font-medium text-brand-500 hover:underline"
                    >
                      {data.busiestProject.name}
                    </Link>
                  </div>
                )}
              </div>

              {/* Activity feed */}
              <div className="card p-5 lg:col-span-2">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-700">Recent activity</h2>
                </div>
                {data.recentActivity.length === 0 ? (
                  <p className="text-sm text-slate-400">No activity yet.</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {data.recentActivity.map((log) => (
                      <div key={log.id} className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                          {log.actor.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-600">
                            <span className="font-medium text-slate-800">{log.actor.name}</span>{' '}
                            <ActivityEventLabel log={log} />
                            {log.project && (
                              <span className="text-slate-400"> in {log.project.name}</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: number; bg: string }) {
  return (
    <div className="card p-4">
      <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center mb-3`}>{icon}</div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

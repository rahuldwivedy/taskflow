'use client';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import api from '@/lib/api';
import { Project } from '@/types';
import Link from 'next/link';
import { Plus, FolderKanban, Users, CheckSquare, Crown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/projects')
      .then(({ data }) => setProjects(data))
      .catch(() => setError('Failed to load projects'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
            <p className="text-slate-500 text-sm mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
          </div>
          <Link href="/projects/new" className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New project
          </Link>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            Loading…
          </div>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}

        {!loading && projects.length === 0 && (
          <div className="text-center py-20">
            <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No projects yet</p>
            <p className="text-slate-400 text-sm mt-1">Create your first project to get started</p>
            <Link href="/projects/new" className="btn-primary inline-flex items-center gap-2 mt-4">
              <Plus className="w-4 h-4" /> New project
            </Link>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}/board`}
              className="card p-5 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center">
                  <FolderKanban className="w-5 h-5 text-brand-500" />
                </div>
                {p.role === 'OWNER' && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                    <Crown className="w-3 h-3" /> Owner
                  </span>
                )}
              </div>
              <h2 className="font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                {p.name}
              </h2>
              {p.description && (
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{p.description}</p>
              )}
              <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <CheckSquare className="w-3.5 h-3.5" />
                  {p._count?.tasks ?? 0} tasks
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {p._count?.members ?? 0} members
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

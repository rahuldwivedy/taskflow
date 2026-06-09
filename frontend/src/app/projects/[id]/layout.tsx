'use client';
import { useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import api from '@/lib/api';
import { Project } from '@/types';
import { LayoutDashboard, List, Activity, Settings, ArrowLeft } from 'lucide-react';
import clsx from 'clsx';

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/projects/${id}`)
      .then(({ data }) => setProject(data))
      .catch(() => setError('Project not found or access denied'));
  }, [id]);

  const tabs = [
    { href: `/projects/${id}/board`, label: 'Board', icon: LayoutDashboard },
    { href: `/projects/${id}/backlog`, label: 'Backlog', icon: List },
    { href: `/projects/${id}/activity`, label: 'Activity', icon: Activity },
    { href: `/projects/${id}/settings`, label: 'Settings', icon: Settings },
  ];

  return (
    <AppShell>
      <div className="flex flex-col h-full min-h-screen">
        {/* Project header */}
        <div className="bg-white border-b border-slate-200 px-8 pt-6 pb-0">
          <Link href="/projects" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mb-3">
            <ArrowLeft className="w-3.5 h-3.5" /> Projects
          </Link>
          {error ? (
            <p className="text-red-600 text-sm py-4">{error}</p>
          ) : (
            <>
              <h1 className="text-xl font-bold text-slate-900">{project?.name ?? '…'}</h1>
              {project?.description && <p className="text-sm text-slate-500 mt-0.5">{project.description}</p>}
            </>
          )}
          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {tabs.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                    active
                      ? 'border-brand-500 text-brand-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700',
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </AppShell>
  );
}

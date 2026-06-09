'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import api from '@/lib/api';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewProjectPage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Project name is required'); return; }
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/projects', { name: name.trim(), description: description.trim() || undefined });
      router.push(`/projects/${data.id}/board`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="p-8 max-w-lg mx-auto">
        <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to projects
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">New project</h1>
        <p className="text-sm text-slate-500 mb-8">Create a workspace for your team</p>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Project name <span className="text-red-500">*</span></label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Alpha Sprint" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Description <span className="text-slate-400 font-normal">(optional)</span></label>
              <textarea className="input resize-none h-24" value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this project about?" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating…</span> : 'Create project'}
              </button>
              <Link href="/projects" className="btn-secondary">Cancel</Link>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

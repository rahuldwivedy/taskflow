'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Project, ProjectMember } from '@/types';
import { useAuthStore } from '@/store/auth';
import { Trash2, UserMinus, UserPlus, Crown, AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [myRole, setMyRole] = useState('MEMBER');

  // Invite
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  // Delete project
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = () => {
    api.get(`/projects/${projectId}`)
      .then(({ data }) => {
        setProject(data);
        setMembers(data.members ?? []);
        const me = (data.members ?? []).find((m: ProjectMember) => m.userId === user?.id);
        if (me) setMyRole(me.role);
      })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [projectId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    setInviteLoading(true);
    try {
      await api.post(`/projects/${projectId}/members`, { email: inviteEmail });
      setInviteSuccess(`${inviteEmail} has been invited!`);
      setInviteEmail('');
      load();
    } catch (err: any) {
      setInviteError(err.response?.data?.message || 'Failed to invite');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemove = async (targetId: string, name: string) => {
    if (!confirm(`Remove ${name} from this project?`)) return;
    try {
      await api.delete(`/projects/${projectId}/members/${targetId}`);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await api.delete(`/projects/${projectId}`);
      router.push('/projects');
    } catch {
      alert('Failed to delete project');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) return (
    <div className="p-8 flex items-center gap-2 text-slate-400 text-sm">
      <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />Loading…
    </div>
  );

  if (error) return <div className="p-8 text-red-600 text-sm">{error}</div>;

  const isOwner = myRole === 'OWNER';

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      {/* Members */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-4">Members ({members.length})</h2>
        <div className="space-y-2 mb-6">
          {members.map(m => (
            <div key={m.userId} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-sm font-bold text-brand-600">
                  {m.user.name[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{m.user.name}</p>
                  <p className="text-xs text-slate-400">{m.user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {m.role === 'OWNER' && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                    <Crown className="w-3 h-3" /> Owner
                  </span>
                )}
                {isOwner && m.userId !== user?.id && m.role !== 'OWNER' && (
                  <button
                    onClick={() => handleRemove(m.userId, m.user.name)}
                    className="text-slate-300 hover:text-red-500 transition-colors"
                    title="Remove member"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Invite */}
        {isOwner && (
          <form onSubmit={handleInvite} className="border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4" /> Invite member
            </h3>
            <div className="flex gap-2">
              <input
                type="email"
                className="input flex-1"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                required
              />
              <button type="submit" className="btn-primary whitespace-nowrap" disabled={inviteLoading}>
                {inviteLoading ? '…' : 'Invite'}
              </button>
            </div>
            {inviteError && <p className="text-xs text-red-600 mt-1.5">{inviteError}</p>}
            {inviteSuccess && <p className="text-xs text-green-600 mt-1.5">{inviteSuccess}</p>}
          </form>
        )}
      </div>

      {/* Danger zone */}
      {isOwner && (
        <div className="card p-6 border-red-200">
          <h2 className="text-base font-semibold text-red-700 mb-1 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Danger zone
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Deleting this project permanently removes all tasks, comments, and activity. This cannot be undone.
          </p>
          {!deleteConfirm ? (
            <button onClick={() => setDeleteConfirm(true)} className="btn-danger flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Delete project
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-red-600">Are you absolutely sure?</p>
              <button onClick={handleDelete} className="btn-danger" disabled={deleteLoading}>
                {deleteLoading ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button onClick={() => setDeleteConfirm(false)} className="btn-secondary">Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

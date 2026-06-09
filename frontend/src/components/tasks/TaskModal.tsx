'use client';
import { useEffect, useState } from 'react';
import { Task, ProjectMember } from '@/types';
import api from '@/lib/api';
import { X, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  projectId: string;
  members: ProjectMember[];
  task?: Task | null;       // null = create mode
  initialStatus?: string;
  onClose: () => void;
  onSaved: (task: Task) => void;
  onDeleted?: (taskId: string) => void;
  currentUserId: string;
  currentUserRole: string;
}

export function TaskModal({
  projectId, members, task, initialStatus = 'TODO',
  onClose, onSaved, onDeleted, currentUserId, currentUserRole,
}: Props) {
  const isEdit = !!task;

  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [priority, setPriority] = useState(task?.priority ?? 'MEDIUM');
  const [status, setStatus] = useState(task?.status ?? initialStatus);
  const [dueDate, setDueDate] = useState(task?.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : '');
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? '');
  const [comments, setComments] = useState<any[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [statusError, setStatusError] = useState('');

  useEffect(() => {
    if (isEdit) {
      api.get(`/projects/${projectId}/tasks/${task.id}/comments`)
        .then(({ data }) => setComments(data))
        .catch(() => {});
    }
  }, [isEdit]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Title cannot be empty';
    if (dueDate && new Date(dueDate) < new Date(new Date().toDateString())) {
      e.dueDate = 'Due date cannot be in the past';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate || undefined,
        assigneeId: assigneeId || undefined,
      };

      let saved: Task;
      if (isEdit) {
        const { data } = await api.patch(`/projects/${projectId}/tasks/${task.id}`, body);
        saved = data;
        // Handle status change separately
        if (status !== task.status) {
          setStatusError('');
          try {
            const { data: s } = await api.patch(`/projects/${projectId}/tasks/${task.id}/status`, { status });
            saved = s;
          } catch (err: any) {
            setStatusError(err.response?.data?.message || 'Cannot change status');
            setLoading(false);
            return;
          }
        }
      } else {
        const { data } = await api.post(`/projects/${projectId}/tasks`, { ...body, status });
        saved = data;
      }
      onSaved(saved);
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setErrors({ form: Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to save task' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await api.delete(`/projects/${projectId}/tasks/${task!.id}`);
      onDeleted?.(task!.id);
      onClose();
    } catch {
      setErrors({ form: 'Failed to delete task' });
    } finally {
      setLoading(false);
    }
  };

  const handleComment = async () => {
    if (!commentBody.trim()) return;
    setCommentLoading(true);
    try {
      const { data } = await api.post(`/projects/${projectId}/tasks/${task!.id}/comments`, { body: commentBody.trim() });
      setComments(c => [...c, data]);
      setCommentBody('');
    } catch {}
    finally { setCommentLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-slate-800">{isEdit ? 'Edit task' : 'New task'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title <span className="text-red-500">*</span></label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to be done?" />
            {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea className="input resize-none h-20" value={description} onChange={e => setDescription(e.target.value)} placeholder="Add more details…" />
          </div>

          {/* Row: status + priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done</option>
              </select>
              {statusError && <p className="text-xs text-red-600 mt-1">{statusError}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select className="input" value={priority} onChange={e => setPriority(e.target.value as any)}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>

          {/* Row: due date + assignee */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Due date</label>
              <input type="date" className="input" value={dueDate} onChange={e => setDueDate(e.target.value)} min={format(new Date(), 'yyyy-MM-dd')} />
              {errors.dueDate && <p className="text-xs text-red-600 mt-1">{errors.dueDate}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Assignee</label>
              <select className="input" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                <option value="">Unassigned</option>
                {members.map(m => (
                  <option key={m.userId} value={m.userId}>{m.user.name}</option>
                ))}
              </select>
            </div>
          </div>

          {errors.form && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errors.form}</p>}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-2">
              <button onClick={handleSave} className="btn-primary" disabled={loading}>
                {loading ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{isEdit ? 'Saving…' : 'Creating…'}</span> : isEdit ? 'Save changes' : 'Create task'}
              </button>
              <button onClick={onClose} className="btn-secondary">Cancel</button>
            </div>
            {isEdit && (
              deleteConfirm
                ? <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600">Sure?</span>
                    <button onClick={handleDelete} className="btn-danger text-xs py-1.5" disabled={loading}>Delete</button>
                    <button onClick={() => setDeleteConfirm(false)} className="btn-secondary text-xs py-1.5">No</button>
                  </div>
                : <button onClick={() => setDeleteConfirm(true)} className="text-slate-400 hover:text-red-500 transition-colors" title="Delete task"><Trash2 className="w-4 h-4" /></button>
            )}
          </div>
        </div>

        {/* Comments section - edit mode only */}
        {isEdit && (
          <div className="px-6 pb-6 border-t border-slate-100 mt-2">
            <h3 className="text-sm font-semibold text-slate-700 mt-4 mb-3">Comments ({comments.length})</h3>
            <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
              {comments.length === 0 && <p className="text-xs text-slate-400">No comments yet.</p>}
              {comments.map(c => (
                <div key={c.id} className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold shrink-0">{c.author.name[0]}</div>
                  <div className="flex-1 bg-slate-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-slate-700">{c.author.name}</span>
                      <span className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-slate-600">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="input flex-1" value={commentBody} onChange={e => setCommentBody(e.target.value)} placeholder="Write a comment…" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); } }} />
              <button onClick={handleComment} className="btn-primary shrink-0" disabled={commentLoading || !commentBody.trim()}>
                {commentLoading ? '…' : 'Send'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

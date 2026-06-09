'use client';
import { Task } from '@/types';
import { Calendar, User, MessageSquare, AlertCircle } from 'lucide-react';
import { format, isPast } from 'date-fns';
import clsx from 'clsx';

const priorityConfig = {
  HIGH:   { label: 'High',   cls: 'badge-high' },
  MEDIUM: { label: 'Medium', cls: 'badge-medium' },
  LOW:    { label: 'Low',    cls: 'badge-low' },
};

interface Props {
  task: Task;
  onClick: () => void;
}

export function TaskCard({ task, onClick }: Props) {
  const p = priorityConfig[task.priority];
  const duePast = task.dueDate && task.status !== 'DONE' && isPast(new Date(task.dueDate));

  return (
    <div
      onClick={onClick}
      className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm hover:shadow-md hover:border-brand-300 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-slate-800 leading-snug group-hover:text-brand-600 transition-colors">
          {task.title}
        </p>
        <span className={`shrink-0 ${p.cls}`}>{p.label}</span>
      </div>

      {task.description && (
        <p className="text-xs text-slate-400 line-clamp-2 mb-2">{task.description}</p>
      )}

      <div className="flex items-center gap-3 flex-wrap mt-2">
        {task.assignee && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <div className="w-4 h-4 rounded-full bg-brand-100 flex items-center justify-center text-[10px] font-bold text-brand-600">
              {task.assignee.name[0]}
            </div>
            <span>{task.assignee.name.split(' ')[0]}</span>
          </div>
        )}

        {task.dueDate && (
          <div className={clsx('flex items-center gap-1 text-xs', duePast ? 'text-red-500' : 'text-slate-400')}>
            {duePast && <AlertCircle className="w-3 h-3" />}
            {!duePast && <Calendar className="w-3 h-3" />}
            {format(new Date(task.dueDate), 'MMM d')}
          </div>
        )}

        {!!task._count?.comments && (
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <MessageSquare className="w-3 h-3" />
            {task._count.comments}
          </div>
        )}
      </div>
    </div>
  );
}

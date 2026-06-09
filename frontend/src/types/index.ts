export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type Role = 'OWNER' | 'MEMBER';

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface ProjectMember {
  userId: string;
  role: Role;
  joinedAt: string;
  user: User;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: string;
  members?: ProjectMember[];
  role?: Role;
  _count?: { tasks: number; members: number };
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  assigneeId?: string;
  assignee?: User;
  createdBy?: User;
  _count?: { comments: number };
}

export interface Comment {
  id: string;
  taskId: string;
  body: string;
  createdAt: string;
  author: User;
}

export interface ActivityLog {
  id: string;
  projectId: string;
  eventType: string;
  payload: Record<string, any>;
  createdAt: string;
  actor: User;
  project?: { id: string; name: string };
}

export interface PaginatedTasks {
  tasks: Task[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

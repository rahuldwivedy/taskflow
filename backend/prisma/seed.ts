import { PrismaClient, Priority, TaskStatus, Role, ActivityEvent } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clear existing data
  await prisma.activityLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  const hash = await bcrypt.hash('Password1!', 12);

  const alice = await prisma.user.create({
    data: { name: 'Alice Johnson', email: 'alice@example.com', passwordHash: hash },
  });

  const bob = await prisma.user.create({
    data: { name: 'Bob Smith', email: 'bob@example.com', passwordHash: hash },
  });

  const charlie = await prisma.user.create({
    data: { name: 'Charlie Dev', email: 'charlie@example.com', passwordHash: hash },
  });

  const project = await prisma.project.create({
    data: { name: 'Alpha Project', description: 'Our flagship product sprint', ownerId: alice.id },
  });

  await prisma.projectMember.createMany({
    data: [
      { projectId: project.id, userId: alice.id, role: Role.OWNER },
      { projectId: project.id, userId: bob.id, role: Role.MEMBER },
      { projectId: project.id, userId: charlie.id, role: Role.MEMBER },
    ],
  });

  const task1 = await prisma.task.create({
    data: {
      projectId: project.id,
      createdById: alice.id,
      assigneeId: bob.id,
      title: 'Set up CI/CD pipeline',
      description: 'Configure GitHub Actions for automated testing and deployment.',
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const task2 = await prisma.task.create({
    data: {
      projectId: project.id,
      createdById: alice.id,
      assigneeId: charlie.id,
      title: 'Design system documentation',
      description: 'Write docs for all reusable UI components.',
      status: TaskStatus.TODO,
      priority: Priority.MEDIUM,
    },
  });

  const task3 = await prisma.task.create({
    data: {
      projectId: project.id,
      createdById: bob.id,
      title: 'Database performance audit',
      description: 'Review slow queries and add missing indexes.',
      status: TaskStatus.TODO,
      priority: Priority.HIGH,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
  });

  const task4 = await prisma.task.create({
    data: {
      projectId: project.id,
      createdById: alice.id,
      assigneeId: alice.id,
      title: 'Project kickoff meeting notes',
      description: 'Summarize and share meeting outcomes.',
      status: TaskStatus.DONE,
      priority: Priority.LOW,
      completedAt: new Date(),
    },
  });

  await prisma.comment.create({
    data: {
      taskId: task1.id,
      authorId: bob.id,
      body: 'I have started on the GitHub Actions workflow. Should be done by Friday.',
    },
  });

  await prisma.comment.create({
    data: {
      taskId: task1.id,
      authorId: alice.id,
      body: 'Great! Let me know if you need access to the deployment secrets.',
    },
  });

  await prisma.activityLog.createMany({
    data: [
      { projectId: project.id, actorId: alice.id, eventType: ActivityEvent.MEMBER_INVITED, payload: { userId: bob.id, name: bob.name } },
      { projectId: project.id, actorId: alice.id, eventType: ActivityEvent.MEMBER_INVITED, payload: { userId: charlie.id, name: charlie.name } },
      { projectId: project.id, actorId: alice.id, eventType: ActivityEvent.TASK_CREATED, payload: { taskId: task1.id, title: task1.title } },
      { projectId: project.id, actorId: alice.id, eventType: ActivityEvent.TASK_ASSIGNED, payload: { taskId: task1.id, title: task1.title, assigneeName: bob.name } },
      { projectId: project.id, actorId: bob.id, eventType: ActivityEvent.TASK_CREATED, payload: { taskId: task3.id, title: task3.title } },
      { projectId: project.id, actorId: bob.id, eventType: ActivityEvent.COMMENT_ADDED, payload: { taskId: task1.id, title: task1.title } },
    ],
  });

  console.log('✅ Seeded successfully!');
  console.log('Test users:');
  console.log('  alice@example.com / Password1!  (project owner)');
  console.log('  bob@example.com   / Password1!  (member, has assigned task)');
  console.log('  charlie@example.com / Password1! (member)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

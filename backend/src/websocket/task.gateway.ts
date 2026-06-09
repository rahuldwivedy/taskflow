import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { Injectable } from '@nestjs/common';

// Map of userId -> Set of socketIds (a user can have multiple tabs open)
const userSocketMap = new Map<string, Set<string>>();
// Map of socketId -> userId
const socketUserMap = new Map<string, string>();

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
})
export class TaskGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      // Extract token from handshake auth
      const token = socket.handshake.auth?.token;
      if (!token) throw new Error('No token');

      const payload = this.jwt.verify(token, {
        secret: process.env.ACCESS_TOKEN_SECRET,
      });

      const userId = payload.sub;
      socket.data.user = { id: userId, email: payload.email, name: payload.name };

      // Track user->socket mapping
      if (!userSocketMap.has(userId)) userSocketMap.set(userId, new Set());
      userSocketMap.get(userId).add(socket.id);
      socketUserMap.set(socket.id, userId);

      // Join all project rooms this user belongs to
      const memberships = await this.prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true },
      });
      for (const { projectId } of memberships) {
        socket.join(`project:${projectId}`);
      }

      // Join personal room for "assigned to me" updates
      socket.join(`user:${userId}`);

      console.log(`Socket connected: user ${userId}, socket ${socket.id}`);
    } catch (err) {
      // Auth failed — disconnect
      socket.emit('exception', { message: 'Unauthorized' });
      socket.disconnect();
    }
  }

  handleDisconnect(socket: Socket) {
    const userId = socketUserMap.get(socket.id);
    if (userId) {
      socketUserMap.delete(socket.id);
      const sockets = userSocketMap.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) userSocketMap.delete(userId);
      }
    }
    console.log(`Socket disconnected: ${socket.id}`);
  }

  // Emit an event to all members of a project
  emitToProject(projectId: string, event: string, data: any) {
    this.server.to(`project:${projectId}`).emit(event, data);
  }

  // Emit to a specific user's personal room
  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // Called when a user is added to a project mid-session
  addUserToProjectRoom(userId: string, projectId: string) {
    const socketIds = userSocketMap.get(userId);
    if (!socketIds) return;
    for (const socketId of socketIds) {
      const socket = this.server.sockets.sockets.get(socketId);
      if (socket) socket.join(`project:${projectId}`);
    }
  }

  // Called when a user is removed from a project mid-session
  removeUserFromProjectRoom(userId: string, projectId: string) {
    const socketIds = userSocketMap.get(userId);
    if (!socketIds) return;
    for (const socketId of socketIds) {
      const socket = this.server.sockets.sockets.get(socketId);
      if (socket) socket.leave(`project:${projectId}`);
    }
  }
}

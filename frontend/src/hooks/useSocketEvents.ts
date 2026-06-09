'use client';
import { useEffect, useRef } from 'react';
import { getSocket } from '../lib/socket';
import { Socket } from 'socket.io-client';

type EventMap = Record<string, (data: any) => void>;

export function useSocketEvents(events: EventMap) {
  const socketRef = useRef<Socket | null>(null);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socketRef.current = socket;

    const handlers: Array<[string, (data: any) => void]> = [];

    for (const [event, handler] of Object.entries(eventsRef.current)) {
      const wrappedHandler = (data: any) => eventsRef.current[event]?.(data);
      socket.on(event, wrappedHandler);
      handlers.push([event, wrappedHandler]);
    }

    return () => {
      handlers.forEach(([event, handler]) => socket.off(event, handler));
    };
  }, []); // only run once on mount
}

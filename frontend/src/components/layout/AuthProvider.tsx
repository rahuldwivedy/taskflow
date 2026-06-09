'use client';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { connectSocket } from '@/lib/socket';
import axios from 'axios';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const { setAccessToken, setUser } = useAuthStore();

  useEffect(() => {
    axios.post(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/refresh`,
      {},
      { withCredentials: true }
    )
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        setUser(data.user);
        connectSocket(data.accessToken);
      })
      .catch(() => {
        // No session, that's fine — go to login
      })
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading TaskFlow…</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AuthWidget() {
  // undefined = still checking session, null = logged out, string = logged-in email
  const [email, setEmail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setEmail(null);
  };

  if (email === undefined) {
    return <span className="text-sm text-zinc-400">&nbsp;</span>;
  }

  if (!email) {
    return (
      <Link href="/login" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
        로그인
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href="/reports" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
        내 리포트
      </Link>
      <span className="hidden text-zinc-400 sm:inline">{email}</span>
      <button
        type="button"
        onClick={handleLogout}
        className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        로그아웃
      </button>
    </div>
  );
}

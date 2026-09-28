"use client";

import { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase-browser";

/** Optional magic-link sign-in so results sync to Supabase. Hidden when Supabase isn't configured. */
export function AccountButton() {
  const db = browserSupabase();
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    if (!db) return;
    db.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data } = db.auth.onAuthStateChange((_e, session) => setEmail(session?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, [db]);

  if (!db) return null;

  if (email) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="hidden sm:inline">{email}</span>
        <button className="underline hover:text-ink" onClick={() => db.auth.signOut()}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button className="text-sm text-muted hover:text-ink" onClick={() => setOpen((o) => !o)}>
        Sign in
      </button>
      {open && (
        <form
          className="absolute right-0 z-20 mt-2 w-72 rounded-lg border border-line bg-card p-3 shadow-lg"
          onSubmit={async (e) => {
            e.preventDefault();
            setStatus("sending");
            const { error } = await db.auth.signInWithOtp({
              email: input,
              options: { emailRedirectTo: window.location.href },
            });
            setStatus(error ? "error" : "sent");
          }}
        >
          <p className="mb-2 text-xs text-muted">Keep your life list in sync across devices. We&apos;ll email you a sign-in link.</p>
          <input
            type="email"
            required
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded border border-line bg-paper px-2 py-1 text-sm"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="mt-2 w-full rounded bg-accent px-2 py-1 text-sm font-medium text-accent-ink disabled:opacity-60"
          >
            {status === "sending" ? "Sending…" : "Email me a link"}
          </button>
          {status === "sent" && <p className="mt-2 text-xs text-muted">Check your inbox.</p>}
          {status === "error" && <p className="mt-2 text-xs text-red-600">Couldn&apos;t send the link. Try again.</p>}
        </form>
      )}
    </div>
  );
}

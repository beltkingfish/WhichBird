"use client";

import { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase-browser";

/** Optional magic-link sign-in so results sync to Supabase. Hidden when Supabase isn't configured. */
export function AccountButton() {
  const db = browserSupabase();
  const [email, setEmail] = useState<string | null>(null);
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
      <div className="dropdown dropdown-end">
        <button tabIndex={0} className="btn btn-ghost btn-sm">
          {email.split("@")[0]}
        </button>
        <ul tabIndex={0} className="menu dropdown-content z-20 mt-2 w-52 rounded-box border border-base-300 bg-base-100 p-1">
          <li className="menu-title truncate">{email}</li>
          <li>
            <button onClick={() => db.auth.signOut()}>Sign out</button>
          </li>
        </ul>
      </div>
    );
  }

  return (
    <div className="dropdown dropdown-end">
      <button tabIndex={0} className="btn btn-outline btn-sm">
        Sign in
      </button>
      <form
        tabIndex={0}
        className="dropdown-content z-20 mt-2 w-72 rounded-box border border-base-300 bg-base-100 p-3"
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
        <fieldset className="fieldset">
          <legend className="fieldset-legend">Sync your results</legend>
          <input
            type="email"
            required
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="you@example.com"
            className="input input-sm w-full"
          />
          <p className="label">We&apos;ll email you a sign-in link.</p>
          <button type="submit" disabled={status === "sending"} className="btn btn-primary btn-sm mt-1">
            {status === "sending" ? <span className="loading loading-spinner loading-xs" /> : "Send link"}
          </button>
          {status === "sent" && <p className="text-success">Link sent. Check your inbox.</p>}
          {status === "error" && <p className="text-error">That didn&apos;t work. Try again.</p>}
        </fieldset>
      </form>
    </div>
  );
}

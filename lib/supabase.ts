import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "placeholder",
  {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

function assertSupabaseEnv() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
}

export async function ensureAnonymousSession() {
  assertSupabaseEnv();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    await supabase.auth.signInAnonymously();
  }
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Null when the env vars aren't set (e.g. a Vercel preview build before the
// project's Environment Variables are configured) rather than throwing at
// import time — createClient() throws synchronously on a missing url, which
// previously crashed `next build`'s static prerendering for every page that
// transitively imports this module, not just the one page that uses it.
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

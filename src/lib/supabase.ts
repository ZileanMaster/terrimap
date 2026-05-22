/**
 * Supabase client singleton.
 *
 * Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from Vite env.
 * If either is missing → supabase = null → offline/mock mode.
 *
 * ANON key is safe to expose client-side — Supabase RLS policies protect data.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string | undefined
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseKey) {
  console.info('[Supabase] env vars not set — running in offline/mock mode')
}

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null

/** true if Supabase is configured */
export const isOnline = (): boolean => supabase !== null

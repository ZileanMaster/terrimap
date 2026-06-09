
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


export const isOnline = (): boolean => supabase !== null

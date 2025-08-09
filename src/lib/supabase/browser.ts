import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseUrl, getSupabaseAnonKey } from '@/env'

export const createSupabaseBrowserClient = () =>
  createBrowserClient(
    getSupabaseUrl(),
    getSupabaseAnonKey()
  ) 
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseUrl, getSupabaseAnonKey } from '@/env'

export function createSupabaseServerClient() {
  const c = cookies()
  return createServerClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: {
        getAll: () => c.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            c.set(name, value, options)
          })
        },
      },
    }
  )
} 
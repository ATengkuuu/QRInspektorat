import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://habihtpwamxmaiaxbprd.supabase.co'
// Using the actual key directly since this is a frontend-only app
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhYmlodHB3YW14bWFpYXhicHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNjkwNjgsImV4cCI6MjA5MDk0NTA2OH0.NiWYXIRUAkpdGfyFZWDn13UA-slq_rAeC3hUBtdLJlE'

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase URL or Key')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

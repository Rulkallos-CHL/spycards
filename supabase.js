// supabase.js - initialize client
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

/*
  IMPORTANT:
  Set environment variables in Netlify (or window globals for local dev):
  - SUPABASE_URL
  - SUPABASE_ANON_KEY

  Do NOT put service_role key in client-side code.
*/

const SUPABASE_URL = window.SUPABASE_URL || 'https://ikdvemulhtrndmhpdhiw.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZHZlbXVsaHRybmRtaHBkaGl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExMjMwNjksImV4cCI6MjA3NjY5OTA2OX0.RbdyWlQO_ZL1REV_I8-O6bjMiRwftEkhMvKdnCUb7hs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true },
  realtime: { params: { eventsPerSecond: 10 } }
});
window.supabaseClient = supabase;

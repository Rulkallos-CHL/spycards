// supabase.js - initialize client
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

/*
  ENVIRONMENT:
  - SUPABASE_URL
  - SUPABASE_ANON_KEY
  In Netlify use environment variables; in local dev, create a .env and a small dev script or embed placeholders.
*/
const SUPABASE_URL = window.SUPABASE_URL || 'https://ikdvemulhtrndmhpdhiw.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZHZlbXVsaHRybmRtaHBkaGl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExMjMwNjksImV4cCI6MjA3NjY5OTA2OX0.RbdyWlQO_ZL1REV_I8-O6bjMiRwftEkhMvKdnCUb7hs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true }
});
window.supabaseClient = supabase; // for debugging in dev only

// supabase.js - initialize client
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

/*
  ENVIRONMENT:
  - SUPABASE_URL
  - SUPABASE_ANON_KEY
  In Netlify use environment variables; in local dev, create a .env and a small dev script or embed placeholders.
*/
const SUPABASE_URL = window.SUPABASE_URL || '<REPLACE_WITH_YOUR_SUPABASE_URL>';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '<REPLACE_WITH_YOUR_ANON_KEY>';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true }
});
window.supabaseClient = supabase; // for debugging in dev only
// Example serverless function (Node.js) for generating a play code and creating a match in Supabase.
// Intended to run as a Supabase Edge Function or Netlify Function using SUPABASE_SERVICE_ROLE key.
// IMPORTANT: Do NOT put service_role key in client code. Deploy this as a server function.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

export async function handler(event, context) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const host_user = body.host_user; // must be validated via JWT in prod
    if(!host_user) return { statusCode: 400, body: JSON.stringify({ error: 'host_user required' }) };
    // generate unique 5-digit code (retry if collision)
    let code = null;
    for(let i=0;i<5;i++){
      const tryCode = Math.floor(10000 + Math.random()*90000).toString();
      const { data } = await supabase.from('matches').select('id').eq('play_code', tryCode).limit(1);
      if(!data || data.length===0){ code = tryCode; break; }
    }
    if(!code) return { statusCode: 500, body: JSON.stringify({ error: 'failed to create code' }) };
    // insert match row
    const { data: match, error } = await supabase.from('matches').insert({ host_user, play_code: code, status: 'waiting' }).select().single();
    if(error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, body: JSON.stringify({ code, match }) };
  } catch(err){
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}

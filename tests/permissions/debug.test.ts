import { describe, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Debug Supabase Connection', () => {
  it('tests queries that might fail on RLS or schema issues', async () => {
    // Load .env.local before importing any client modules
    const envPath = path.resolve(__dirname, '../../.env.local');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const parts = trimmed.split('=');
          const key = parts[0].trim();
          const value = parts.slice(1).join('=').trim();
          process.env[key] = value;
        }
      }
    }

    // Now dynamically import supabase
    const { supabase } = await import('@/lib/db');

    if (!supabase) {
      console.log('Supabase client not configured.');
      return;
    }

    console.log('1. Querying profiles...');
    const { data: profiles, error: pError } = await supabase.from('profiles').select('*').limit(5);
    if (pError) console.error('Profiles query failed:', pError);
    else console.log('Profiles query success, count:', profiles.length);

    console.log('2. Querying leaderboard_admins...');
    const { data: admins, error: aError } = await supabase.from('leaderboard_admins').select('*').limit(5);
    if (aError) console.error('leaderboard_admins query failed:', aError);
    else console.log('leaderboard_admins query success, count:', admins.length);

    console.log('3. Running can_manage_leaderboard function test...');
    const { data: fnVal, error: fError } = await supabase.rpc('can_manage_leaderboard', {
      p_leaderboard_id: '00000000-0000-0000-0000-000000000000',
      p_user_id: '00000000-0000-0000-0000-000000000000'
    });
    if (fError) console.error('can_manage_leaderboard rpc failed:', fError);
    else console.log('can_manage_leaderboard rpc success, returned:', fnVal);
  });
});

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lpumyabyytnyuzgmnqgq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwdW15YWJ5eXRueXV6Z21ucWdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTE4NzA1OCwiZXhwIjoyMTAwNzYzMDU4fQ.fLGlQxzjOqhKYGgAA4NiIV7u_OxC6yLOOsSR_Spd-FI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Checking all leaderboards...");
  const { data, count, error } = await supabase
    .from('leaderboards')
    .select('id, slug, name, description, competition_type, template_key, engine, cover_image_url, updated_at, rankings:leaderboard_rankings(count)', { count: 'exact' })
    .eq('visibility', 'public')
    .eq('status', 'active');
  if (error) {
    console.error(error);
  } else {
    console.log(`Total leaderboards in DB: ${data.length}`);
    const publicActive = data.filter(d => d.visibility === 'public' && d.status === 'active');
    console.log(`Public & Active: ${publicActive.length}`);
    if (publicActive.length > 0) {
      console.log(publicActive.map(lb => ({ name: lb.name, visibility: lb.visibility, status: lb.status })));
    }
  }
}
test();

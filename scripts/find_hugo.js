const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findHugo() {
  const { data: invs } = await supabaseAdmin.from('player_invitations').select('*').ilike('full_name', '%Hugo%');
  const { data: players } = await supabaseAdmin.from('players').select('*').ilike('last_name', '%Jimenez%');

  console.log('INVITATIONS:', invs);
  console.log('PLAYERS:', players);
}

findHugo();

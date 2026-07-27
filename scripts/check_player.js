const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase
    .from('players')
    .select('id, first_name, last_name, email, adjective, organization_id, user_id')
    .eq('email', 'diego.ciria.lopez@gmail.com');

  console.log('CHECK PLAYER RESULTS:', JSON.stringify({ data, error }, null, 2));
}

check();

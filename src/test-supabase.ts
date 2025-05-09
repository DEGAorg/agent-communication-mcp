import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

console.log('Testing Supabase connection...');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseAnonKey?.substring(0, 20) + '...');

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

async function testConnection() {
  try {
    const { data, error } = await supabase.from('agents').select('count').limit(1);
    if (error) throw error;
    console.log('Connection successful!');
    console.log('Data:', data);
  } catch (error) {
    console.error('Connection failed:', error);
  }
}

testConnection(); 
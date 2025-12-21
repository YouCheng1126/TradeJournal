import { createClient } from '@supabase/supabase-js';

// 預設使用合法的 URL 格式以避免 TypeError: Failed to construct 'URL'
// 請將下方的 URL 和 Key 替換為您自己的 Supabase 專案資訊
const SUPABASE_URL: string = 'https://eyrfezmycumfboahfecj.supabase.co';
const SUPABASE_ANON_KEY: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cmZlem15Y3VtZmJvYWhmZWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNDk0NDYsImV4cCI6MjA4MTcyNTQ0Nn0.6H-lFjdcJuEByAjnmSf-cfVvFgVL2_Hpx-8maljauQ0';

// 檢查使用者是否已經設定了正確的 URL (非預設值)
export const isSupabaseConfigured = 
  SUPABASE_URL !== 'https://placeholder-project.supabase.co' && 
  !SUPABASE_URL.includes('填入正確的URL和KEY');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// =============================================================
//  Conexão com o Supabase (usado pelo criar-pix e pelo webhook)
//  Credenciais nas variáveis de ambiente:
//    SUPABASE_URL e SUPABASE_SERVICE_KEY
// =============================================================

import { createClient } from "@supabase/supabase-js";

let _cliente = null;

export function getSupabase() {
  if (_cliente) return _cliente;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null; // sem credenciais, funções degradam sem quebrar
  _cliente = createClient(url, key, { auth: { persistSession: false } });
  return _cliente;
}

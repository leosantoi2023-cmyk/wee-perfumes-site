// =============================================================
//  Wee Perfumes — Lista de pedidos (protegida por senha)
//  Acesse: /api/pedidos?senha=SUA_SENHA
//  A senha fica na variável de ambiente PAINEL_SENHA.
// =============================================================

import { getSupabase } from "./_supabase.js";

export default async function handler(req, res) {
  const senha = req.query.senha || "";
  const esperada = process.env.PAINEL_SENHA || "";

  if (!esperada || senha !== esperada) {
    return res.status(401).json({ ok: false, erro: "Senha inválida" });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ ok: false, erro: "Banco não configurado" });
  }

  // Filtro opcional por status (?status=pago)
  let query = supabase.from("pedidos").select("*").order("id", { ascending: false }).limit(200);
  if (req.query.status) query = query.eq("status", req.query.status);

  const { data, error } = await query;
  if (error) {
    return res.status(500).json({ ok: false, erro: error.message });
  }

  return res.status(200).json({ ok: true, total: data.length, pedidos: data });
}

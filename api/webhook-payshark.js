// =============================================================
//  Wee Perfumes — Webhook do PayShark (cartão)
//  Valida a assinatura X-Signature (HMAC SHA256 Base64) e atualiza
//  o status do pedido no Supabase. Envia Purchase à Meta se PAID.
// =============================================================

import crypto from "crypto";
import { getSupabase } from "./_supabase.js";
import { enviarCompraMeta } from "./_meta.js";

export const config = { api: { bodyParser: false } };

function lerCorpoCru(req) {
  return new Promise((resolve) => {
    let dados = "";
    req.on("data", (c) => (dados += c));
    req.on("end", () => resolve(dados));
    req.on("error", () => resolve(""));
  });
}

function assinaturaValida(rawBody, assinatura, secret) {
  if (!assinatura || !secret) return false;
  const esperada = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(esperada);
  const b = Buffer.from(String(assinatura).trim());
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false });
  }

  const corpoCru = await lerCorpoCru(req);
  const secret = process.env.PAYSHARK_WEBHOOK_SECRET || "";
  const assinatura = req.headers["x-signature"] || "";

  // Validação opcional (só se o secret estiver configurado)
  if (secret) {
    if (!assinaturaValida(corpoCru, assinatura, secret)) {
      console.log("Webhook PayShark rejeitado: assinatura inválida.");
      return res.status(401).json({ ok: false });
    }
  }

  let evento = {};
  try { evento = JSON.parse(corpoCru || "{}"); } catch (_) {}

  // O payload pode vir com os dados direto ou aninhado
  const pg = evento.data || evento.payment || evento;
  const id = pg.id || evento.id || "";
  const status = String(pg.status || evento.status || "").toUpperCase();

  console.log(`Webhook PayShark — id: ${id} — status: ${status}`);

  if (!id) return res.status(200).json({ ok: true });

  try {
    const supabase = getSupabase();
    if (supabase) {
      const { data: pedido } = await supabase
        .from("pedidos").select("*").eq("transaction_id", id).single();

      if (pedido) {
        // Mapeia status do PayShark para o nosso
        let novoStatus = pedido.status;
        if (status === "PAID") novoStatus = "pago";
        else if (["REFUSED", "REFUNDED", "CHARGEDBACK", "MED"].includes(status)) novoStatus = "recusado";

        if (novoStatus !== pedido.status) {
          await supabase.from("pedidos").update({
            status: novoStatus,
            pago_em: novoStatus === "pago" ? new Date().toISOString() : pedido.pago_em,
          }).eq("transaction_id", id);

          // Se virou pago agora, envia à Meta
          if (novoStatus === "pago") {
            await enviarCompraMeta({
              email: pedido.email, telefone: pedido.whatsapp, cpf: pedido.cpf,
              nome: pedido.nome, valor: pedido.total, eventId: id, produto: pedido.produto,
            });
          }
        }
      }
    }
  } catch (e) {
    console.log("Erro webhook PayShark:", e.message);
  }

  return res.status(200).json({ ok: true });
}

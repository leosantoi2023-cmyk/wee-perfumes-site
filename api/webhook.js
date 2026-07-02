// =============================================================
//  Wee Perfumes — Webhook da Pimpou
//  Ao receber payment.approved: valida a assinatura, marca o pedido
//  como pago no Supabase e cria o pedido na RastroCode (gera rastreio).
// =============================================================

import crypto from "crypto";
import { getSupabase } from "./_supabase.js";
import { enviarCompraMeta } from "./_meta.js";

export const config = { api: { bodyParser: false } };

const RASTROCODE_BASE = "https://app.rastrocode.site/api/v1";

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
  const esperada = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(esperada);
  const b = Buffer.from(String(assinatura).replace(/^sha256=/i, "").trim());
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function criarPedidoRastroCode(p) {
  const chave = process.env.RASTROCODE_API_KEY;
  if (!chave) {
    console.log("RASTROCODE_API_KEY nao configurada — pulando criacao do pedido.");
    return { ok: false, tracking: null };
  }
  const pedido = {
    transaction_id: p.transaction_id,
    customer: {
      name: p.nome,
      email: p.email,
      phone: String(p.whatsapp).replace(/\D/g, ""),
      document: String(p.cpf).replace(/\D/g, ""),
    },
    address: {
      street: p.rua,
      number: String(p.numero),
      complement: p.complemento || "",
      neighborhood: p.bairro,
      city: p.cidade,
      state: String(p.uf).toUpperCase(),
      zipcode: String(p.cep).replace(/\D/g, ""),
    },
    products: [{ name: p.produto, quantity: 1, price: Number(p.total) }],
    total: Number(p.total),
  };

  const r = await fetch(`${RASTROCODE_BASE}/orders`, {
    method: "POST",
    headers: { "X-API-Key": chave, "Content-Type": "application/json" },
    body: JSON.stringify(pedido),
  });
  const corpo = await r.json().catch(() => ({}));
  if (r.ok && corpo.success) {
    const tracking = corpo.data?.tracking_code || null;
    console.log(`Pedido criado na RastroCode — txid ${p.transaction_id} — rastreio: ${tracking || "(ja processado)"}`);
    return { ok: true, tracking };
  }
  console.log(`Erro RastroCode (${r.status}):`, JSON.stringify(corpo));
  return { ok: false, tracking: null };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, erro: "Metodo nao permitido" });
  }

  const corpoCru = await lerCorpoCru(req);
  const secret = process.env.PIMPOU_WEBHOOK_SECRET || "";
  const assinatura = req.headers["x-pimpou-signature"] || "";

  if (secret) {
    if (!assinaturaValida(corpoCru, assinatura, secret)) {
      console.log("Webhook rejeitado: assinatura invalida ou ausente.");
      return res.status(401).json({ ok: false, erro: "Assinatura invalida" });
    }
  } else {
    console.log("AVISO: PIMPOU_WEBHOOK_SECRET nao configurado.");
  }

  let evento = {};
  try { evento = JSON.parse(corpoCru || "{}"); } catch (_) {}

  const tipo = evento.event || req.headers["x-pimpou-event"] || "";
  const dados = evento.data || {};
  const txid = dados.transactionId || "";

  if (tipo === "payment.approved" && txid) {
    console.log(`PAGAMENTO APROVADO — txid: ${txid} — valor: R$ ${dados.amount}`);
    try {
      const supabase = getSupabase();
      if (supabase) {
        // Busca o pedido salvo quando o cliente gerou o PIX
        const { data: pedido } = await supabase
          .from("pedidos").select("*").eq("transaction_id", txid).single();

        if (pedido && pedido.status !== "pago") {
          const resultado = await criarPedidoRastroCode(pedido);
          await supabase.from("pedidos").update({
            status: "pago",
            pago_em: new Date().toISOString(),
            tracking_code: resultado.tracking,
          }).eq("transaction_id", txid);

          // Envia a compra para a Meta (API de Conversões) — não bloqueável.
          // Usa o txid como event_id para a Meta deduplicar com o pixel do navegador.
          await enviarCompraMeta({
            email: pedido.email,
            telefone: pedido.whatsapp,
            cpf: pedido.cpf,
            nome: pedido.nome,
            valor: pedido.total,
            eventId: txid,
            produto: pedido.produto,
          });
        } else if (!pedido) {
          console.log(`Sem registro no Supabase para o txid ${txid}.`);
        }
      }
    } catch (e) {
      console.log("Erro ao processar pos-pagamento:", e.message);
    }
  } else {
    console.log(`Evento recebido: ${tipo} — txid: ${txid || "?"}`);
  }

  return res.status(200).json({ success: true });
}

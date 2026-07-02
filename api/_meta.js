// =============================================================
//  Envio de eventos para a API de Conversões da Meta (server-side)
//  Variáveis de ambiente: META_PIXEL_ID e META_CONVERSIONS_TOKEN
//  Não é bloqueável por AdBlock/iOS, pois sai do servidor.
// =============================================================

import crypto from "crypto";

// Hash SHA256 (a Meta exige que dados pessoais sejam "hasheados")
function hash(valor) {
  if (!valor) return undefined;
  return crypto.createHash("sha256").update(String(valor).trim().toLowerCase()).digest("hex");
}

// Envia um evento de compra (Purchase) para a Meta
export async function enviarCompraMeta({ email, telefone, cpf, nome, valor, moeda = "BRL", eventId, produto }) {
  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CONVERSIONS_TOKEN;
  if (!pixelId || !token) {
    console.log("Meta CAPI não configurada (falta META_PIXEL_ID ou META_CONVERSIONS_TOKEN).");
    return;
  }

  // Separa nome e sobrenome para o hash (a Meta usa fn/ln)
  const partes = String(nome || "").trim().split(" ");
  const primeiroNome = partes[0] || "";
  const sobrenome = partes.length > 1 ? partes[partes.length - 1] : "";
  const telNumeros = String(telefone || "").replace(/\D/g, "");
  // telefone no formato E.164 sem símbolos, com DDI 55 (Brasil)
  const telComDDI = telNumeros ? (telNumeros.startsWith("55") ? telNumeros : "55" + telNumeros) : "";

  const evento = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId, // mesmo id do pixel do navegador → a Meta dedup automaticamente
        action_source: "website",
        user_data: {
          em: hash(email),
          ph: hash(telComDDI),
          fn: hash(primeiroNome),
          ln: hash(sobrenome),
          external_id: hash(cpf),
        },
        custom_data: {
          currency: moeda,
          value: Number(valor) || 0,
          content_name: produto || "Pedido Wee Perfumes",
        },
      },
    ],
  };

  try {
    const r = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(evento),
    });
    const corpo = await r.json().catch(() => ({}));
    if (r.ok && corpo.events_received) {
      console.log(`Meta CAPI: evento Purchase enviado (recebidos: ${corpo.events_received}).`);
    } else {
      console.log("Meta CAPI erro:", JSON.stringify(corpo));
    }
  } catch (e) {
    console.log("Meta CAPI falha de rede:", e.message);
  }
}

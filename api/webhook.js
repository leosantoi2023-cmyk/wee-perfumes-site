// =============================================================
//  Wee Perfumes — Webhook da Pimpou
//  Recebe avisos de pagamento e valida a assinatura HMAC SHA256.
//  Segue a documentação oficial: header x-pimpou-signature (hex).
//  O segredo fica na variável de ambiente PIMPOU_WEBHOOK_SECRET.
// =============================================================

import crypto from "crypto";

// Precisamos do corpo "cru" (raw) para validar a assinatura,
// então desligamos o parser automático da Vercel.
export const config = {
  api: { bodyParser: false },
};

function lerCorpoCru(req) {
  return new Promise((resolve) => {
    let dados = "";
    req.on("data", (c) => (dados += c));
    req.on("end", () => resolve(dados));
    req.on("error", () => resolve(""));
  });
}

// Validação da assinatura conforme a doc da Pimpou
function assinaturaValida(rawBody, assinatura, secret) {
  if (!assinatura || !secret) return false;
  const esperada = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(esperada);
  const b = Buffer.from(String(assinatura).replace(/^sha256=/i, "").trim());
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, erro: "Método não permitido" });
  }

  const corpoCru = await lerCorpoCru(req);
  const secret = process.env.PIMPOU_WEBHOOK_SECRET || "";
  const assinatura = req.headers["x-pimpou-signature"] || "";

  // ---- Valida que o aviso é realmente da Pimpou ----
  if (secret) {
    if (!assinaturaValida(corpoCru, assinatura, secret)) {
      console.log("Webhook rejeitado: assinatura invalida ou ausente.");
      return res.status(401).json({ ok: false, erro: "Assinatura invalida" });
    }
  } else {
    console.log("AVISO: PIMPOU_WEBHOOK_SECRET nao configurado - nao foi possivel validar a assinatura.");
  }

  // ---- Lê o evento ----
  let evento = {};
  try { evento = JSON.parse(corpoCru || "{}"); } catch (_) {}

  const tipo = evento.event || req.headers["x-pimpou-event"] || "";
  const dados = evento.data || {};
  const txid = dados.transactionId || "?";

  if (tipo === "payment.approved") {
    // PAGAMENTO CONFIRMADO de forma confiavel (mesmo com a aba do cliente fechada)
    console.log(`PAGAMENTO APROVADO - txid: ${txid} - valor: R$ ${dados.amount} - liquido: R$ ${dados.netAmount}`);
    // Futuro: enviar e-mail, salvar em banco, avisar no WhatsApp, etc.
  } else if (tipo === "cashout.completed") {
    console.log(`Saque concluido - id: ${dados.cashoutId} - valor: R$ ${dados.amount}`);
  } else {
    console.log(`Evento recebido: ${tipo} - txid: ${txid}`);
  }

  // Responde 2xx rapido para a Pimpou confirmar a entrega (conforme a doc)
  return res.status(200).json({ success: true });
}

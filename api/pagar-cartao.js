// =============================================================
//  Wee Perfumes — Pagamento com CARTÃO (PayShark)
//  Tokeniza o cartão no servidor (chave nunca exposta) e cobra.
//  Chave na variável de ambiente: PAYSHARK_API_KEY
// =============================================================

import sodium from "libsodium-wrappers";
import { getSupabase } from "./_supabase.js";

const PAYSHARK_BASE = "https://api.gatewaypayshark.com.br/v1";

// Mesmos produtos e preços do PIX (travados no servidor)
const PRODUTOS = {
  feminino: { nome: "Kit Feminino - Wee Perfumes", preco: 179.60 },
  masculino: { nome: "Kit Masculino - Wee Perfumes", preco: 179.60 },
  combo: { nome: "Combo Feminino + Masculino - Wee Perfumes (6 perfumes)", preco: 329.90 },
};

const CUPONS = { WEE20: 0.20 };

// Tokeniza o cartão usando a chave de API (crypto_box_seal, conforme a doc)
async function tokenizarCartao(card, apiKey) {
  await sodium.ready;
  const payload = {
    number: String(card.number).replace(/\D/g, ""),
    holder: String(card.holder).trim(),
    expMonth: String(card.expMonth),
    expYear: String(card.expYear),
    cvv: String(card.cvv).replace(/\D/g, ""),
  };
  const encrypted = sodium.crypto_box_seal(
    sodium.from_string(JSON.stringify(payload)),
    sodium.from_base64(apiKey)
  );
  return sodium.to_base64(encrypted);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, erro: "Método não permitido" });
  }

  try {
    const apiKey = process.env.PAYSHARK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ ok: false, erro: "PayShark não configurado no servidor." });
    }

    const dados = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const produto = PRODUTOS[dados.kit];
    if (!produto) return res.status(400).json({ ok: false, erro: "Produto inválido." });

    // Validação dos campos obrigatórios
    const obrigatorios = ["nome", "whatsapp", "cpf", "cep", "rua", "numero", "bairro", "cidade", "uf",
      "cardNumber", "cardHolder", "cardMonth", "cardYear", "cardCvv"];
    for (const campo of obrigatorios) {
      if (!dados[campo] || String(dados[campo]).trim() === "") {
        return res.status(400).json({ ok: false, erro: `Preencha o campo: ${campo}` });
      }
    }

    const cpf = String(dados.cpf).replace(/\D/g, "");
    if (cpf.length !== 11) return res.status(400).json({ ok: false, erro: "CPF inválido." });

    // Parcelas: 1 a 6
    let parcelas = parseInt(dados.installments) || 1;
    if (parcelas < 1) parcelas = 1;
    if (parcelas > 6) parcelas = 6;

    // Preço (com cupom, validado aqui no servidor)
    const cupom = String(dados.cupom || "").trim().toUpperCase();
    const desconto = CUPONS[cupom] || 0;
    const valorReais = Math.round(produto.preco * (1 - desconto) * 100) / 100;
    const valorCentavos = Math.round(valorReais * 100);

    // 1) Tokeniza o cartão (no servidor — chave nunca exposta ao cliente)
    let token;
    try {
      token = await tokenizarCartao({
        number: dados.cardNumber,
        holder: dados.cardHolder,
        expMonth: dados.cardMonth,
        expYear: dados.cardYear,
        cvv: dados.cardCvv,
      }, apiKey);
    } catch (e) {
      console.log("Erro ao tokenizar cartão:", e.message);
      return res.status(400).json({ ok: false, erro: "Dados do cartão inválidos. Confira e tente novamente." });
    }

    // 2) Cria o pagamento no PayShark
    const externalRef = "wee_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || undefined;
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["host"] || "www.tempestshop.online";

    const corpo = {
      amount: valorCentavos,
      currency: "BRL",
      method: "CREDIT_CARD",
      description: `${produto.nome}${desconto ? " (CUPOM " + cupom + ")" : ""}`,
      externalRef,
      notificationUrl: `${proto}://${host}/api/webhook-payshark`,
      ip,
      payer: {
        name: dados.nome,
        taxId: cpf,
        email: dados.email || "naoinformado@tempestshop.online",
        phone: String(dados.whatsapp).replace(/\D/g, ""),
      },
      items: [{ quantity: 1, name: produto.nome, price: valorCentavos, type: "PHYSICAL" }],
      delivery: {
        fee: 0,
        address: {
          country: "BR",
          state: String(dados.uf).toUpperCase(),
          city: dados.cidade,
          district: dados.bairro,
          street: dados.rua,
          number: String(dados.numero),
          complement: dados.complemento || null,
          zipCode: String(dados.cep).replace(/\D/g, ""),
        },
      },
      card: { token, installments: parcelas, billingAddress: null },
    };

    const r = await fetch(`${PAYSHARK_BASE}/payment`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify(corpo),
    });
    const resp = await r.json().catch(() => ({}));

    if (!r.ok) {
      console.log("Erro PayShark:", r.status, JSON.stringify(resp));
      const msg = resp?.message || resp?.error?.message || "Pagamento não aprovado. Verifique os dados do cartão.";
      return res.status(402).json({ ok: false, erro: msg });
    }

    const status = String(resp.status || "").toUpperCase();
    const aprovado = ["PAID", "APPROVED", "AUTHORIZED", "CONFIRMED"].includes(status);

    // Salva o pedido no Supabase
    try {
      const supabase = getSupabase();
      if (supabase) {
        await supabase.from("pedidos").upsert({
          transaction_id: resp.id || externalRef,
          status: aprovado ? "pago" : "recusado",
          produto: produto.nome,
          total: valorReais,
          cupom: cupom || null,
          nome: dados.nome,
          email: dados.email || "naoinformado@tempestshop.online",
          whatsapp: String(dados.whatsapp).replace(/\D/g, ""),
          cpf: cpf,
          rua: dados.rua, numero: dados.numero, complemento: dados.complemento || "",
          bairro: dados.bairro, cidade: dados.cidade, uf: String(dados.uf).toUpperCase(),
          cep: String(dados.cep).replace(/\D/g, ""),
          pago_em: aprovado ? new Date().toISOString() : null,
        }, { onConflict: "transaction_id" });
      }
    } catch (e) {
      console.log("Aviso: falha ao salvar pedido cartão no Supabase:", e.message);
    }

    if (aprovado) {
      return res.status(200).json({ ok: true, aprovado: true, id: resp.id, valor: valorReais, produto: produto.nome });
    } else {
      return res.status(402).json({ ok: false, erro: "Pagamento recusado pela operadora. Tente outro cartão." });
    }
  } catch (e) {
    console.log("Falha interna cartão:", e.message);
    return res.status(500).json({ ok: false, erro: "Erro interno. Tente novamente." });
  }
}

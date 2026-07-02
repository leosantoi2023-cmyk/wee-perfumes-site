// =============================================================
//  Wee Perfumes — Criar cobrança PIX (Vercel Serverless Function)
//  Formato oficial da documentação Pimpou API v2
// =============================================================

import { getSupabase } from "./_supabase.js";

const PIMPOU_BASE = "https://api.pimpou.com/api/v2";

// Preços definidos AQUI no servidor (o visitante não consegue alterar)
const PRODUTOS = {
  feminino: { nome: "Kit Feminino - Wee Perfumes", preco: 179.60 },
  masculino: { nome: "Kit Masculino - Wee Perfumes", preco: 179.60 },
  combo: { nome: "Combo Feminino + Masculino - Wee Perfumes (6 perfumes)", preco: 329.90 },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  try {
    if (!process.env.PIMPOU_API_KEY || !process.env.PIMPOU_API_SECRET) {
      return res.status(500).json({ erro: "Chaves da Pimpou não configuradas no painel da Vercel." });
    }

    const dados = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const produto = PRODUTOS[dados.kit];
    if (!produto) return res.status(400).json({ erro: "Produto inválido." });

    // Validação dos dados do comprador
    const obrigatorios = ["nome", "whatsapp", "cpf", "cep", "rua", "numero", "bairro", "cidade", "uf"];
    for (const campo of obrigatorios) {
      if (!dados[campo] || String(dados[campo]).trim() === "") {
        return res.status(400).json({ erro: `Preencha o campo: ${campo}` });
      }
    }

    const cpf = String(dados.cpf).replace(/\D/g, "");
    if (cpf.length !== 11) {
      return res.status(400).json({ erro: "CPF inválido — digite os 11 números." });
    }

    // Aplica cupom de desconto (validado aqui no servidor, não dá para burlar pelo navegador)
    const CUPONS = { WEE20: 0.20 }; // 20% de desconto
    const cupomInformado = String(dados.cupom || "").trim().toUpperCase();
    const desconto = CUPONS[cupomInformado] || 0;
    const valorFinal = Math.round(produto.preco * (1 - desconto) * 100) / 100;

    // Endereço de entrega vai na descrição, para você ver no painel da Pimpou
    const endereco = `${dados.rua}, ${dados.numero}${dados.complemento ? " " + dados.complemento : ""} - ${dados.bairro}, ${dados.cidade}/${dados.uf} - CEP ${dados.cep}`;
    const cupomTxt = desconto ? ` | CUPOM ${cupomInformado} (-${desconto*100}%)` : "";
    const descricao = `${produto.nome}${cupomTxt} | ${dados.nome} | Zap: ${dados.whatsapp} | Entrega: ${endereco}`.slice(0, 250);

    // Payload EXATAMENTE como na documentação da Pimpou
    const payload = {
      amount: valorFinal,
      description: descricao,
      customer: {
        name: dados.nome,
        email: dados.email || "naoinformado@tempestshop.online",
        phone: String(dados.whatsapp).replace(/\D/g, ""),
        document: {
          type: "cpf",
          number: cpf,
        },
      },
    };

    const resposta = await fetch(`${PIMPOU_BASE}/pix/create`, {
      method: "POST",
      headers: {
        "X-API-Key": process.env.PIMPOU_API_KEY,
        "X-API-Secret": process.env.PIMPOU_API_SECRET,
        "Idempotency-Key": globalThis.crypto?.randomUUID
          ? crypto.randomUUID()
          : require("crypto").randomUUID(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const corpo = await resposta.json().catch(() => ({}));

    // A Pimpou pode responder em dois formatos; aceitamos ambos:
    //  doc:  { status: true,  paymentData: { transactionId, copiaecola, qrcode } }
    //  real: { success: true, data:        { transactionId, copiaecola, qrCode } }
    const p = corpo.paymentData || corpo.data || {};
    const txid = p.transactionId || p.txid || null;
    const copiaCola = p.copyPaste || p.copiaecola || p.copiaECola || p.copia_cola || p.brcode || null;
    const qrImagem = p.qrcode || p.qrCode || p.qr_code || null;

    if (resposta.ok && (corpo.success === true || corpo.status === true) && txid && copiaCola) {
      // Salva o pedido no Supabase como "pendente". Quando o pagamento for
      // confirmado (webhook), atualizamos para "pago" e criamos na RastroCode.
      try {
        const supabase = getSupabase();
        if (supabase) {
          await supabase.from("pedidos").upsert(
            {
              transaction_id: txid,
              status: "pendente",
              produto: produto.nome,
              total: valorFinal,
              cupom: cupomInformado || null,
              nome: dados.nome,
              email: dados.email || "naoinformado@tempestshop.online",
              whatsapp: String(dados.whatsapp).replace(/\D/g, ""),
              cpf: cpf,
              rua: dados.rua,
              numero: dados.numero,
              complemento: dados.complemento || "",
              bairro: dados.bairro,
              cidade: dados.cidade,
              uf: String(dados.uf).toUpperCase(),
              cep: String(dados.cep).replace(/\D/g, ""),
            },
            { onConflict: "transaction_id" }
          );
        }
      } catch (e) {
        // Se o Supabase falhar, o PIX ainda é gerado (não bloqueia a venda)
        console.log("Aviso: não consegui salvar o pedido no Supabase:", e.message);
      }

      return res.status(200).json({
        txid,
        copiaCola,
        qrImagem, // base64 (o checkout adiciona o prefixo se precisar)
        valor: valorFinal,
        produto: produto.nome,
      });
    }

    // Log para diagnóstico (Vercel > projeto > Logs)
    console.log("Erro/resposta inesperada Pimpou:", resposta.status, JSON.stringify(corpo));
    return res.status(502).json({
      erro: "Não foi possível gerar o PIX agora. Tente novamente.",
      detalhe: corpo,
    });
  } catch (e) {
    console.log("Falha interna:", e.message);
    return res.status(500).json({ erro: "Erro interno. Tente novamente." });
  }
}

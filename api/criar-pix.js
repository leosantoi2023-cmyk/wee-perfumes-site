// =============================================================
//  Wee Perfumes — Criar cobrança PIX (Vercel Serverless Function)
//  Formato oficial da documentação Pimpou API v2
// =============================================================

const PIMPOU_BASE = "https://api.pimpou.com/api/v2";

// Preços definidos AQUI no servidor (o visitante não consegue alterar)
const PRODUTOS = {
  feminino: { nome: "Kit Feminino - Wee Perfumes", preco: 173.90 },
  masculino: { nome: "Kit Masculino - Wee Perfumes", preco: 173.90 },
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

    // Endereço de entrega vai na descrição, para você ver no painel da Pimpou
    const endereco = `${dados.rua}, ${dados.numero}${dados.complemento ? " " + dados.complemento : ""} - ${dados.bairro}, ${dados.cidade}/${dados.uf} - CEP ${dados.cep}`;
    const descricao = `${produto.nome} | ${dados.nome} | Zap: ${dados.whatsapp} | Entrega: ${endereco}`.slice(0, 250);

    // Payload EXATAMENTE como na documentação da Pimpou
    const payload = {
      amount: produto.preco,
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

    // Sucesso conforme a doc: { status: true, paymentData: { transactionId, copiaecola, qrcode, ... } }
    const p = corpo.paymentData;
    if (resposta.ok && p && p.transactionId && p.copiaecola) {
      return res.status(200).json({
        txid: p.transactionId,
        copiaCola: p.copiaecola,
        qrImagem: p.qrcode || null, // vem em base64
        valor: produto.preco,
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

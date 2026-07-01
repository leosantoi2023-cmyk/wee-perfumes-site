// =============================================================
//  Wee Perfumes — Criar cobrança PIX (Vercel Serverless Function)
//  As chaves ficam nas variáveis de ambiente: PIMPOU_API_KEY e PIMPOU_API_SECRET
// =============================================================

const PIMPOU_BASE = "https://api.pimpou.com/api/v2";

// Preços definidos AQUI no servidor (o visitante não consegue alterar)
const PRODUTOS = {
  feminino: { nome: "Kit Feminino - Wee Perfumes (3 perfumes 100ml)", preco: 173.90 },
  masculino: { nome: "Kit Masculino - Wee Perfumes (3 perfumes 100ml)", preco: 173.90 },
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

    // Validação simples dos dados do comprador
    const obrigatorios = ["nome", "whatsapp", "cep", "rua", "numero", "bairro", "cidade", "uf"];
    for (const campo of obrigatorios) {
      if (!dados[campo] || String(dados[campo]).trim() === "") {
        return res.status(400).json({ erro: `Preencha o campo: ${campo}` });
      }
    }

    // Dados do pedido vão na descrição, para você ver no painel da Pimpou
    const endereco = `${dados.rua}, ${dados.numero}${dados.complemento ? " " + dados.complemento : ""} - ${dados.bairro}, ${dados.cidade}/${dados.uf} - CEP ${dados.cep}`;
    const descricao = `${produto.nome} | Cliente: ${dados.nome} | Zap: ${dados.whatsapp} | Entrega: ${endereco}`.slice(0, 250);

    // Chamada à Pimpou
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
      // Enviamos o valor em vários formatos comuns; a API usa o que reconhecer.
      // Se a doc da Pimpou pedir um nome de campo específico, ajuste aqui.
      body: JSON.stringify({
        amount: produto.preco,
        value: produto.preco,
        valor: produto.preco,
        description: descricao,
        descricao: descricao,
        payer: { name: dados.nome, phone: dados.whatsapp, email: dados.email || undefined },
      }),
    });

    const corpo = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
      console.log("Erro Pimpou:", resposta.status, JSON.stringify(corpo));
      return res.status(502).json({ erro: "Não foi possível gerar o PIX agora. Tente novamente.", detalhe: corpo });
    }

    // As APIs variam os nomes dos campos; procuramos os mais comuns.
    const d = corpo.data || corpo;
    const txid =
      d.txid || d.transaction_id || d.transactionId || d.id || null;
    const copiaCola =
      d.copia_cola || d.copiaecola || d.pix_copia_e_cola || d.brcode || d.br_code ||
      d.emv || d.qr_code_text || d.qrcode_text || d.pixCopiaECola || d.copy_paste || null;
    const qrImagem =
      d.qr_code_image || d.qrcode_image || d.qr_code_base64 || d.qrcode_base64 ||
      d.qr_code_url || d.image || null;

    if (!txid || !copiaCola) {
      // Log para diagnóstico (visível em Vercel > seu projeto > Logs)
      console.log("Resposta inesperada da Pimpou:", JSON.stringify(corpo));
      return res.status(502).json({ erro: "A Pimpou respondeu num formato inesperado.", detalhe: corpo });
    }

    return res.status(200).json({ txid, copiaCola, qrImagem, valor: produto.preco, produto: produto.nome });
  } catch (e) {
    console.log("Falha interna:", e.message);
    return res.status(500).json({ erro: "Erro interno. Tente novamente." });
  }
}

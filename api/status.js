// =============================================================
//  Wee Perfumes — Consultar status do pagamento PIX (Vercel)
// =============================================================

const PIMPOU_BASE = "https://api.pimpou.com/api/v2";

export default async function handler(req, res) {
  const txid = req.query.txid;

  if (!txid || !/^[A-Za-z0-9\-_.]{4,100}$/.test(txid)) {
    return res.status(400).json({ erro: "txid inválido" });
  }

  const resposta = await fetch(`${PIMPOU_BASE}/transactions/${encodeURIComponent(txid)}/status`, {
    headers: {
      "X-API-Key": process.env.PIMPOU_API_KEY,
      "X-API-Secret": process.env.PIMPOU_API_SECRET,
    },
  });

  const corpo = await resposta.json().catch(() => ({}));
  const d = corpo.data || corpo;

  // Status varia entre APIs; consideramos pago os valores mais comuns
  const status = String(d.status || d.situacao || "").toLowerCase();
  const pago = ["paid", "pago", "approved", "aprovado", "completed", "complete", "concluida", "concluída", "confirmed", "confirmado", "success", "sucesso"].includes(status);

  return res.status(200).json({ pago, status });
}

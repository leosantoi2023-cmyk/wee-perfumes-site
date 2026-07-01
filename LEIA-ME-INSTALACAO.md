# 📦 PASSO A PASSO — Instalar o checkout PIX no seu site (VERCEL)

Feito para quem NÃO programa. É só seguir na ordem. Tempo estimado: 15 minutos.

---

## O que tem neste pacote

- Seu site original (nada foi removido)
- **checkout.html** → nova página de pagamento PIX
- **obrigado.html** → página que aparece após o pagamento
- **pasta api/** → a parte "invisível" que conversa com a Pimpou de forma segura
- Os botões "COMPRAR KIT" do seu site já apontam para o checkout ✅

---

## PASSO 1 — Pegar suas chaves na Pimpou

1. Entre no painel da Pimpou
2. Procure a área de **API** ou **Integrações**
3. Copie dois códigos: a **API Key** e o **API Secret**
4. Cole os dois num bloco de notas por enquanto

⚠️ Essas chaves são como a senha do seu banco. Nunca envie por WhatsApp
ou chat, nunca cole dentro dos arquivos do site, nunca compartilhe.

---

## PASSO 2 — Guardar as chaves com segurança na Vercel

(Fazemos ANTES do upload para já subir tudo funcionando)

1. Acesse https://vercel.com e faça login
2. Clique no projeto do seu site (Wee Perfumes)
3. Vá em **Settings** (Configurações) → **Environment Variables**
4. Crie estas duas variáveis:

   | Key (nome)           | Value (valor)                |
   |----------------------|------------------------------|
   | PIMPOU_API_KEY       | (cole aqui sua API Key)      |
   | PIMPOU_API_SECRET    | (cole aqui seu API Secret)   |

   ⚠️ Os nomes precisam ser EXATAMENTE esses, em maiúsculas.
   Deixe marcado para valer em "Production" (e pode marcar Preview também).

5. Clique em **Save** para cada uma
6. Apague as chaves do bloco de notas 😉

---

## PASSO 3 — Subir o site atualizado na Vercel

Como você subiu seu site na Vercel da primeira vez? Siga o mesmo caminho:

### Se você fez upload direto (arrastar arquivos):
1. No painel da Vercel, entre no projeto
2. Faça um novo deploy enviando TODOS os arquivos deste pacote,
   mantendo a estrutura:

```
index.html
checkout.html
obrigado.html
css/
images/
js/
api/               ← essa pasta é essencial!
  ├── criar-pix.js
  └── status.js
```

### Se seu site está ligado ao GitHub:
1. Substitua os arquivos no seu repositório pelos deste pacote
   (pode arrastar tudo pela própria página do GitHub: Add file → Upload files)
2. A Vercel publica sozinha em ~1 minuto

💡 A pasta **api** precisa estar na RAIZ, do mesmo jeito que está no pacote.
É ela que a Vercel transforma automaticamente na parte do servidor.

---

## PASSO 4 — Testar (não pule!)

1. Abra seu site pelo endereço publicado (https://seusite.vercel.app)
   — NÃO abrindo o arquivo direto do computador, senão dá "Failed to fetch"
2. Clique em "COMPRAR KIT FEMININO"
3. Preencha o formulário com seus próprios dados
4. Veja se o QR Code aparece
5. Pague você mesmo o PIX (o dinheiro vai para a SUA conta Pimpou, então
   você não perde nada — e ainda confirma que o dinheiro está caindo certo)
6. Depois de pagar, a tela deve mudar sozinha para "Pagamento confirmado!"
   em até ~10 segundos
7. Confira no painel da Pimpou: a cobrança aparece com a descrição contendo
   o nome e o ENDEREÇO DE ENTREGA do cliente — é assim que você vai saber
   para onde enviar cada pedido

---

## Como funciona o dia a dia

- Cliente clica em COMPRAR → preenche endereço → paga o PIX
- Você vê os pagamentos no painel da Pimpou
- Na descrição de cada cobrança paga está: produto, nome, WhatsApp e endereço
- Você embala e envia o kit, e avisa o cliente pelo WhatsApp dele

---

## Se algo der errado

| Problema | O que fazer |
|---|---|
| "Failed to fetch" | Você está abrindo o arquivo direto do PC, ou a pasta api não subiu. Teste pelo endereço https://... e confira a pasta api |
| "Chaves da Pimpou não configuradas" | Refaça o Passo 2 e publique de novo |
| "A Pimpou respondeu num formato inesperado" | Os nomes dos campos da API deles são diferentes do padrão. Me mande essa mensagem de erro no Claude que eu ajusto o código em 1 minuto |
| QR Code não aparece | Aperte F12 → aba Console, tire um print e me mande |
| Checkout dá erro 404 | O checkout.html não subiu — refaça o upload completo |

---

## Avisos importantes

- O preço (R$ 173,90) está travado no servidor — ninguém consegue alterar
  o valor pelo navegador. Se um dia mudar o preço, edite o arquivo
  api/criar-pix.js (ou me peça que eu gero a versão nova).
- Se algum dia suspeitar que suas chaves vazaram, gere chaves novas no
  painel da Pimpou e atualize o Passo 2.

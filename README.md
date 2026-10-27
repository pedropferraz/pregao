# Pregão do Dia

Boletim diário do mercado financeiro (Brasil + mundo): números, notícias explicadas, curva de juros, analistas, agenda, conceito do dia e uma questão de prova.

- Site: https://pedropferraz.github.io/pregao/
- As edições ficam na tabela `pregao_edicoes` do Supabase (leitura pública, escrita só pela tarefa agendada).
- Uma tarefa agendada no Claude pesquisa o mercado e grava a edição nova todo dia por volta das 7h (Brasília).

## Ao vivo (noticias.html)

- Feed de notícias do mercado atualizado a cada 5 minutos.
- Coletor: Edge Function `noticias` no Supabase (código em `supabase/functions/noticias`), chamada por `pg_cron` a cada 5 min. Lê RSS de InfoMoney, Money Times, Seu Dinheiro, Exame, Investing.com, Agência Brasil, MarketWatch, CNBC, BBC, CoinDesk, Federal Reserve e Google Notícias, e grava na tabela `noticias` (leitura pública).
- Texto completo dentro do app só para fontes que permitem reprodução (Agência Brasil, com crédito; comunicados do Federal Reserve, domínio público). As demais mostram título e resumo do próprio feed e abrem a matéria no site original.

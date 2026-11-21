# Copinha dos Lixos

Site para organizar a Copinha dos Lixos (FIFA e Bomba Patch): sorteio dos times, tabela de jogos, placares, histórico das edições e ranking de títulos, finais e participações.

Qualquer pessoa com o link vê tudo. Só quem tem a senha de administrador cria edições e lança placares.

## Rodar no computador

Precisa do Node 22 ou mais novo.

```
npm install
npm run dev
```

Abra http://localhost:3000. O banco local fica em `data/copinha.db` e é criado sozinho.

Para entrar como administrador, clique em **Entrar** e use a senha definida em `ADMIN_PASSWORD` no arquivo `.env.local` (veja `.env.example`).

## Como usar

1. **Nova edição** (botão + em Edições): nome, jogo, formato, participantes e a lista de times do sorteio.
2. **Sortear times**: o site sorteia um time para cada participante e revela um por vez. Também dá para definir ou corrigir o time de alguém à mão.
3. **Gerar tabela e começar**: sorteia os grupos (ou o chaveamento) e cria todos os jogos. Com grupos, o sorteio vira uma cena de estádio: o placar sorteia o nome e o grupo, e o jogador pula para fora de um caminhão de lixo para se juntar ao grupo dele no gramado.
4. **Lançar placares**: toque em "Placar" no jogo. A classificação e o mata-mata se atualizam sozinhos; a edição encerra quando a final é lançada.
5. **Festa do campeão**: ao lançar o último placar, abre a cerimônia de premiação no estádio (3º lugar, vice e campeão no pódio). Qualquer pessoa pode rever pelo botão "Rever a festa" na página da edição.

Formatos disponíveis, escolhidos por edição:

- **Grupos + mata-mata**: 2 ou mais grupos, com 2, 4, 8 ou 16 classificados (usa os melhores terceiros quando a conta não fecha). Os confrontos podem ser dentro do grupo, contra o outro grupo (A com B, C com D) ou mistos; a classificação é sempre por grupo. No misto dá para definir quantos jogos cada um faz contra o outro grupo.
- **Pontos corridos**: todos contra todos, com campeão por pontos ou com final, semifinais ou quartas.
- **Mata-mata**: chaveamento direto; se o número de participantes não for potência de 2, alguns folgam na primeira fase.
- **Registro histórico**: para edições antigas, só participantes, times e colocações, sem jogos.

Na página da edição, o admin pode montar os grupos à mão (antes de gerar a tabela ou depois, refazendo as rodadas) e gerar as rodadas de novo mantendo os grupos. Nos dois casos os placares lançados são apagados. O admin também pode escolher à mão quem joga cada confronto do mata-mata (as vagas que dependem do vencedor de outro jogo não são editáveis); quem muda de confronto perde o placar e os jogos seguintes são refeitos. Também dá para aumentar (ou diminuir) as fases do mata-mata com a copa em andamento (por exemplo, de semifinais para quartas): os jogos dos grupos e seus placares continuam, e o mata-mata é refeito.

Dá para criar a edição só com os jogadores, sem times: desmarque "Cada participante joga com um time" ao criar (ou em "Dados e formato", antes de gerar a tabela). Sem times não há sorteio nem lista de times, e a tabela é gerada direto.

Na página de cada jogador, o admin pode escolher a aparência do avatar em pixel art (pele, cabelo, corte e camisa) ou deixar o automático, sorteado a partir do nome. A lista de jogadores tem um campo de pesquisa por nome (sem diferenciar maiúsculas e acentos).

Fotos dos jogadores: ao criar ou editar um jogador dá para enviar uma foto do aparelho. Ela é recortada em quadrado e reduzida no navegador e fica guardada no banco (por isso funciona na hospedagem). Também continua valendo o link de foto.

Sorteio na TV: em "Sortear na TV" (ou no botão "Tela cheia", ou a tecla F, durante o sorteio) a cena aumenta para ocupar a tela toda, com a tela mantida acesa e o cursor escondido. Esc sai da tela cheia.

Ranking: mostra o pódio dos três primeiros do filtro escolhido (mais títulos, finais, participações, vitórias, gols ou pontuação geral) e, abaixo, a tabela de todos. A pontuação geral soma 3 pontos por vitória e 1 por empate. Há ainda as visões de Times e de Recordes.

Configurações da edição: o botão "Configurações" (só para o admin) na página de uma edição abre a tela com participantes, times do sorteio, grupos e rodadas, fases e confrontos do mata-mata, dados, desfazer tabela e excluir.

Escudos dos times: em Admin → Times, toque no escudo de um time para buscar a imagem na [API-Football](https://www.api-football.com) (aparecem as opções, com o país; escolha a certa), colar o link de uma imagem ou tirar o escudo. O botão "Buscar escudos das ligas" preenche de uma vez os times do catálogo (`npm run db:seed:times`) que ainda não têm escudo, com uma consulta por liga; os que ela não achar ficam listados para a busca individual. Precisa da chave do plano grátis da API-Football (100 consultas por dia) em `API_FOOTBALL_KEY`, no `.env.local` e nas variáveis da Vercel. O escudo aparece dentro da moldura dourada nos cartões dos jogos, nas tabelas e no ranking; sem escudo (ou se o link quebrar), continua a sigla com a cor do time.

Imagens, ícones, fontes, cores e desenhos do app (e como trocar cada um): veja [ASSETS.md](ASSETS.md).

Regras que o site aplica:

- Desempate nos grupos: pontos, vitórias, saldo, gols pró, confronto direto e, por último, a ordem do sorteio.
- Empate no mata-mata exige o placar dos pênaltis. Nas estatísticas, esse jogo conta como empate.
- Corrigir um placar antigo refaz o mata-mata: se o confronto seguinte mudar, o placar dele é apagado.

## Colocar no ar

A forma mais simples e gratuita é Vercel (site) + Turso (banco).

1. Crie um banco no [Turso](https://turso.tech) e anote a URL (`libsql://...`) e um token de acesso.
2. Suba este projeto para um repositório no GitHub e importe na [Vercel](https://vercel.com).
3. Na Vercel, cadastre as variáveis de ambiente:
   - `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` (ou, se usar a integração do Turso na Vercel, veja o aviso abaixo)
   - `ADMIN_PASSWORD` (a senha de administrador)
   - `AUTH_SECRET` (qualquer texto longo e aleatório)
4. Faça o deploy. As tabelas do banco são criadas automaticamente durante o build.

Sem as variáveis do Turso o site usa um arquivo local, que não persiste na Vercel.

**Atenção com a integração do Turso na Vercel:** ela cria uma *branch* do banco para cada deploy (`dpl-...`) e aponta `TURSO_DATABASE_URL` para ela. Assim, os dados lançados num deploy ficam só naquela branch e o deploy seguinte começa sem eles. Para o site de produção usar sempre o mesmo banco:

1. No Turso, abra o banco principal (o que não é uma branch `dpl-...`) e anote a URL e crie um token de acesso.
2. Na Vercel, em Settings > Environment Variables, cadastre `COPINHA_DATABASE_URL` e `COPINHA_DATABASE_TOKEN` com esses valores, **só no ambiente Production**. Elas têm prioridade sobre as do Turso.
3. Faça um novo deploy. O log do build mostra "Banco atualizado: <endereço>"; confira que é o do banco principal.

Os deploys de teste (Preview) continuam usando branches, o que é bom para testar sem mexer nos dados reais.

## Para desenvolver

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe o site em modo de desenvolvimento |
| `npm test` | Roda os testes das regras do torneio e do banco |
| `npm run lint` | Verifica o código |
| `npm run db:generate` | Gera uma migração depois de mudar `src/db/schema.ts` |
| `npm run db:migrate` | Aplica as migrações no banco |
| `npm run db:copy` | Copia os dados de um banco para outro (veja o topo de `scripts/copy-db.mjs`) |
| `npm run db:seed:times` | Cadastra os times do Brasileirão (A, B e C), das ligas da Inglaterra, Itália, Espanha, Portugal, França, Alemanha, Holanda e Argentina e da MLS (lista em `scripts/times.json`). Só acrescenta os que faltam; com as variáveis do Turso, cadastra no banco da nuvem |

Onde fica cada coisa:

- `src/lib/tournament.ts`: regras puras (tabela, classificação, chaveamento, colocações).
- `src/lib/services.ts`: leitura e escrita no banco.
- `src/lib/stats.ts`: ranking, retrospecto e recordes.
- `src/app`: páginas e ações do servidor (`actions.ts`).
- `src/app/globals.css`: o tema visual de jogo 16 bits (cores, fontes, janelas, placar). Os ícones e os bonecos dos jogadores em pixel art ficam em `src/components/icons.tsx` e `src/components/Avatar.tsx`.

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

Onde fica cada coisa:

- `src/lib/tournament.ts`: regras puras (tabela, classificação, chaveamento, colocações).
- `src/lib/services.ts`: leitura e escrita no banco.
- `src/lib/stats.ts`: ranking, retrospecto e recordes.
- `src/app`: páginas e ações do servidor (`actions.ts`).
- `src/app/globals.css`: o tema visual de jogo 16 bits (cores, fontes, janelas, placar). Os ícones e os bonecos dos jogadores em pixel art ficam em `src/components/icons.tsx` e `src/components/Avatar.tsx`.

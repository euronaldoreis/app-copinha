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
3. **Gerar tabela e começar**: sorteia os grupos (ou o chaveamento) e cria todos os jogos. Com grupos, o sorteio vira uma cena de estádio: o placar sorteia o nome e o grupo, e o jogador sai do túnel para se juntar ao grupo dele no gramado.
4. **Lançar placares**: toque em "Placar" no jogo. A classificação e o mata-mata se atualizam sozinhos; a edição encerra quando a final é lançada.

Formatos disponíveis, escolhidos por edição:

- **Grupos + mata-mata**: 2 ou mais grupos, com 2, 4, 8 ou 16 classificados (usa os melhores terceiros quando a conta não fecha). Os confrontos podem ser dentro do grupo, contra o outro grupo (A com B, C com D) ou mistos; a classificação é sempre por grupo. No misto dá para definir quantos jogos cada um faz contra o outro grupo.
- **Pontos corridos**: todos contra todos, com campeão por pontos ou com final, semifinais ou quartas.
- **Mata-mata**: chaveamento direto; se o número de participantes não for potência de 2, alguns folgam na primeira fase.
- **Registro histórico**: para edições antigas, só participantes, times e colocações, sem jogos.

Regras que o site aplica:

- Desempate nos grupos: pontos, vitórias, saldo, gols pró, confronto direto e, por último, a ordem do sorteio.
- Empate no mata-mata exige o placar dos pênaltis. Nas estatísticas, esse jogo conta como empate.
- Corrigir um placar antigo refaz o mata-mata: se o confronto seguinte mudar, o placar dele é apagado.

## Colocar no ar

A forma mais simples e gratuita é Vercel (site) + Turso (banco).

1. Crie um banco no [Turso](https://turso.tech) e anote a URL (`libsql://...`) e um token de acesso.
2. Suba este projeto para um repositório no GitHub e importe na [Vercel](https://vercel.com).
3. Na Vercel, cadastre as variáveis de ambiente:
   - `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`
   - `ADMIN_PASSWORD` (a senha de administrador)
   - `AUTH_SECRET` (qualquer texto longo e aleatório)
4. Faça o deploy. As tabelas do banco são criadas automaticamente durante o build.

Sem as variáveis do Turso o site usa um arquivo local, que não persiste na Vercel.

## Para desenvolver

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe o site em modo de desenvolvimento |
| `npm test` | Roda os testes das regras do torneio e do banco |
| `npm run lint` | Verifica o código |
| `npm run db:generate` | Gera uma migração depois de mudar `src/db/schema.ts` |
| `npm run db:migrate` | Aplica as migrações no banco |

Onde fica cada coisa:

- `src/lib/tournament.ts`: regras puras (tabela, classificação, chaveamento, colocações).
- `src/lib/services.ts`: leitura e escrita no banco.
- `src/lib/stats.ts`: ranking, retrospecto e recordes.
- `src/app`: páginas e ações do servidor (`actions.ts`).
- `src/app/globals.css`: o tema visual de jogo 16 bits (cores, fontes, janelas, placar). Os ícones e os bonecos dos jogadores em pixel art ficam em `src/components/icons.tsx` e `src/components/Avatar.tsx`.

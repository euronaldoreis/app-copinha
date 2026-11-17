# Assets e ícones da Copinha dos Lixos

Guia de tudo que é imagem, ícone, fonte e desenho no projeto, para quem for criar ou trocar assets.

**O que saber primeiro:** o app tem pouquíssimos arquivos de imagem. Quase tudo é **desenhado em código**: pixel art em grades de texto, SVG e CSS. Por isso há dois jeitos de trocar um visual:

1. **Arquivo de imagem** (favicon, ícones de instalação, tela sem internet): é só substituir o arquivo.
2. **Desenho em código** (ícones do menu, jogadores, caminhão, estádio): é editar a grade de pixels ou o CSS indicado abaixo.

Sumário: [1. Arquivos de imagem](#1-arquivos-de-imagem) · [2. Imagem de compartilhamento](#2-imagem-de-compartilhamento-whatsapp) · [3. Fontes](#3-fontes) · [4. Ícones da interface](#4-ícones-da-interface) · [5. Jogadores](#5-jogadores-em-pixel-art) · [6. Cenário](#6-cenário-caminhão-estádio-abertura) · [7. Cores](#7-cores-do-tema) · [8. Fotos dos jogadores](#8-fotos-dos-jogadores) · [9. Checklist para trocar a identidade](#9-checklist-para-trocar-a-identidade-visual) · [10. Armadilhas](#10-armadilhas)

---

## 1. Arquivos de imagem

| Arquivo | O que é | Formato e tamanho | Hoje mostra |
| --- | --- | --- | --- |
| [src/app/icon.png](src/app/icon.png) | Favicon (ícone da aba do navegador) | PNG 256×256, fundo transparente | Escudo dourado de seis lados, fundo azul, taça dourada com reciclagem verde |
| [src/app/apple-icon.png](src/app/apple-icon.png) | Ícone ao "adicionar à tela de início" no iPhone/iPad | PNG 180×180, fundo marinho `#0f2466` | Brasão a 84% do quadro |
| [public/icon-192.png](public/icon-192.png) | Ícone do app instalado (Android/PC) | PNG 192×192, fundo transparente | Brasão a 94% do quadro |
| [public/icon-512.png](public/icon-512.png) | Ícone do app instalado, tamanho grande | PNG 512×512, fundo transparente | Brasão a 94% do quadro |
| [public/icon-maskable-512.png](public/icon-maskable-512.png) | Ícone "adaptável" do Android (o sistema recorta em círculo, quadrado arredondado etc.) | PNG 512×512, fundo marinho `#0f2466` | Brasão a 70%, dentro da área segura |
| [public/brasao.png](public/brasao.png) | Brasão na barra de cima (componente `Emblem` em [src/components/TopBarBrand.tsx](src/components/TopBarBrand.tsx)) | PNG 147×192, fundo transparente, sem sobra em volta | O mesmo escudo dos ícones |
| [public/offline.html](public/offline.html) | Tela mostrada sem internet | HTML com CSS embutido (sem imagem) | Texto "Sem conexão" e botão |
| [src/app/manifest.ts](src/app/manifest.ts) | Cadastro do app instalável (nome, cores, quais ícones usar) | TypeScript | , |
| [public/sw.js](public/sw.js) | Service worker: guarda arquivos estáticos e a tela sem internet | JavaScript | , |

> Os cinco ícones saem de uma única imagem do brasão (PNG quadrado com fundo transparente). Para trocar, gere os cinco de novo a partir da imagem nova, com os mesmos tamanhos e fundos da tabela, e aumente o `VERSION` do [public/sw.js](public/sw.js).

### Como o Next.js usa esses arquivos
- `src/app/icon.png` e `src/app/apple-icon.png` são pegos **pelo nome do arquivo**: o Next gera sozinho as tags `<link rel="icon">` e `<link rel="apple-touch-icon">`, com um código no final da URL para o navegador não ficar com o antigo. Basta substituir o arquivo, mantendo o nome.
- Os PNGs em `public/` são referenciados por caminho em [src/app/manifest.ts](src/app/manifest.ts) (`/icon-192.png`, `/icon-512.png`, `/icon-maskable-512.png`). Se mudar um nome, mude lá também.
- O favicon pode ser trocado por `icon.png` ou `favicon.ico` (nomes que o Next também reconhece), mas **não deixe dois ao mesmo tempo** para não haver dúvida de qual vale.

### Requisitos de cada ícone
- **Favicon:** precisa se ler em 16×16 px. O brasão tem bastante detalhe, mas a silhueta (escudo dourado com a taça) ainda se reconhece na aba.
- **PNGs de instalação:** quadrados e sem cantos arredondados: o sistema aplica a máscara. O `apple-icon` **não pode ter transparência** (o iPhone pinta de preto), por isso tem fundo marinho. Os ícones `any` (192 e 512) ficam transparentes, para o brasão aparecer solto na área de trabalho.
- **Maskable:** o símbolo precisa caber no **círculo central de 80%** da imagem (cerca de 205 px de margem em cada lado numa imagem de 512). Fora disso o Android pode cortar. Use o mesmo fundo de cor sólida até a borda.
- Imagens de pixel art: exporte **sem suavização** (vizinho mais próximo), senão as bordas ficam borradas.

### Tela sem internet e service worker
- [public/offline.html](public/offline.html) usa as cores do tema direto no CSS (`#0b0e2e`, `#04051a`, `#ffd42a`, `#f6f6fa`, `#a9acd0`). Se mudar a paleta, mude aqui também.
- [public/sw.js](public/sw.js) guarda antecipadamente `offline.html`, `icon-192.png` e `icon-512.png`, e guarda por cache-primeiro todo `.png`, `.svg` e `.woff/.woff2` do mesmo site. **Veja a [armadilha do cache](#10-armadilhas).**

---

## 2. Imagem de compartilhamento (WhatsApp)

[src/app/opengraph-image.tsx](src/app/opengraph-image.tsx) **gera** a imagem de pré-visualização do link (WhatsApp, Telegram, redes sociais). Não é um arquivo: é código que desenha uma imagem **1200×630 PNG** em `/opengraph-image`.

- Fundo noturno (`#04051a`), faixa de gramado listrada, **bola** (pixels) à esquerda, **taça** (pixels) à direita, **três setas de reciclagem** (vetor) acima do título "COPINHA DOS LIXOS".
- A bola e a taça são grades de texto no próprio arquivo (`BALL`, `TROPHY`); as setas são um `<svg>` com o caminho `M73 73 H47 V63 L26 79 L47 95 V85 H73 Z` girado 0°, 120° e 240° em torno de `(50, 56)`, o mesmo desenho do favicon.
- Usa a fonte **Press Start 2P** lida do pacote `@fontsource/press-start-2p` (`node_modules/.../press-start-2p-latin-400-normal.woff`). A imagem do WhatsApp é gerada por uma biblioteca que só aceita arquivos de fonte **TTF, OTF ou WOFF** (não WOFF2).
- As tags `og:` e `twitter:` ficam em [src/app/layout.tsx](src/app/layout.tsx). Para a imagem aparecer, o site precisa ter endereço público (`NEXT_PUBLIC_SITE_URL`, ver [README.md](README.md)).
- Para usar uma imagem pronta em vez de gerar: troque o arquivo por `opengraph-image.png` (1200×630) na mesma pasta e apague o `.tsx`.

---

## 3. Fontes

Carregadas em [src/app/layout.tsx](src/app/layout.tsx) pelo `next/font/google` (baixadas no build e servidas pelo próprio site):

| Fonte | Variável CSS | Onde é usada |
| --- | --- | --- |
| **Jersey 10** | `--font-body` | Texto corrido, campos, listas |
| **Jersey 20** | `--font-bold` | "Negrito" (nomes, destaques) e botões |
| **Press Start 2P** | `--font-display` | Títulos, rótulos pequenos, placar, números do pódio |

- As variáveis viram as famílias do Tailwind em [src/app/globals.css](src/app/globals.css) (`--font-sans`, `--font-strong`, `--font-pixel`).
- **Tamanho:** as Jersey só ficam nítidas em **20 px**, então todo o texto usa esse tamanho e a hierarquia vem da fonte e da cor. Ao trocar de fonte, teste de novo os tamanhos.
- **Acentos na fonte 8×8:** a Press Start 2P desenha mal letras maiúsculas acentuadas. O componente [src/components/Arcade.tsx](src/components/Arcade.tsx) (com [src/lib/arcade.ts](src/lib/arcade.ts)) escreve a letra sem acento e desenha o acento em pixels por cima. Todo texto na fonte de títulos deve passar por `<Arcade>`. Se trocar a fonte por uma que acentue bem, dá para parar de usá-lo.

---

## 4. Ícones da interface

Todos em [src/components/icons.tsx](src/components/icons.tsx), desenhados como **grade de texto**: cada `"#"` é um pixel aceso e `"."` é vazio. O desenho é um SVG que usa `currentColor`, então **herda a cor do texto** onde for usado (ex.: `text-accent` deixa amarelo).

```tsx
export const TrashIcon = pixelIcon([
  "....####....",
  ".##########.",
  // ... uma linha de texto por linha de pixels
]);
// uso: <TrashIcon width={20} height={20} className="text-danger" />
```

- O tamanho da grade **vale o desenho**: linhas de comprimentos iguais; o SVG se ajusta (`viewBox`) a qualquer largura × altura. A maioria usa 12×12.
- Para criar um novo: adicione `export const NomeIcon = pixelIcon([...])` e use `<NomeIcon />`.

| Ícone | Grade | Onde aparece |
| --- | --- | --- |
| `HomeIcon` | 12×12 | Menu de baixo: Início |
| `CalendarIcon` | 12×12 | Menu de baixo: Edições |
| `ChartIcon` | 12×12 | Menu de baixo: Ranking |
| `PeopleIcon` | 12×12 | Menu de baixo: Jogadores; aba Grupos da edição |
| `TrophyIcon` | 12×12 | Aba Mata-mata; contador de títulos; festa do campeão |
| `SwordsIcon` | 16×16 | Aba Jogos da edição |
| `PlusIcon` | 12×12 | Botão de nova edição (lista de edições) |
| `ChevronIcon` | 12×12 | Setinha de menu, "Voltar", "Ver completo" |
| `ShuffleIcon` | 12×12 | Botão "Sortear times" |
| `LockIcon` | 12×12 | "Entrar" (login do admin) na barra de cima |
| `BallIcon` | 12×12 | Marca na barra de cima e na abertura |
| `RecycleIcon` | 15×14 | Marca na barra de cima, título da página inicial, abertura |
| `SaveIcon` | 12×12 | Salvar o time de um participante |
| `CheckIcon` | 12×12 | Time já salvo (botão amarelo) |
| `TrashIcon` | 12×12 | Remover participante |
| `ExpandIcon` | 12×12 | Tela cheia do sorteio dos grupos |
| `CrownIcon` | 12×12 | 1º lugar do pódio do ranking |
| `MedalIcon` | 12×12 | 2º e 3º lugares do pódio do ranking |
| `SettingsIcon` | 12×12 | Botão de configurações da edição |
| `PencilIcon` | 12×12 | **Não é usado hoje** (pode ser apagado ou reaproveitado) |

> O `RecycleIcon` usa a grade `RECYCLE_PIXELS` de [src/lib/sprite.ts](src/lib/sprite.ts), a mesma que desenha o símbolo na caçamba do caminhão. Mudar essa grade muda os dois.
> Existe também uma versão **vetorial** das setas de reciclagem (três setas girando 120°), mais nítida em tamanho grande; ela só aparece no favicon e na imagem de compartilhamento.

---

## 5. Jogadores em pixel art

Quem não tem foto ganha um boneco desenhado em código. Há duas versões do mesmo jogador (mesmas cores):

| O que | Arquivo | Grade |
| --- | --- | --- |
| **Retrato** (listas, ranking, pódio, cabeçalho do jogador) | [src/components/Avatar.tsx](src/components/Avatar.tsx) | 12×12: cabeça (7 linhas, 4 cortes de cabelo) + tronco (5 linhas) |
| **Corpo inteiro** (sorteio dos grupos, festa do campeão, abertura) | [src/components/PlayerSprite.tsx](src/components/PlayerSprite.tsx) | 12×16: cabeça (6 linhas, 4 cortes) + tronco e calção (6) + pernas (4, em 2 quadros de caminhada) |
| **Cores e escolhas** | [src/lib/sprite.ts](src/lib/sprite.ts) | Listas `SKIN`, `HAIR`, `SHIRT`, `HAIR_STYLES` |

**Letras das grades:** `H` cabelo · `S` pele · `E` olho · `M` boca · `J` camisa · `C` gola · `P` calção · `K` meião · `B` chuteira · `.` vazio.

**Paletas atuais** (em `sprite.ts`):
- Pele (4): `#f6c9a0` `#e2a877` `#b97a4e` `#8a5632`
- Cabelo (5): `#1d1a1a` `#4a2c17` `#8c5a2b` `#d8a531` `#b9b9c4`
- Camisa (9) como `[camisa, gola e calção]`: vermelho, azul, amarelo, rosa, branco, preto, laranja, roxo, ciano. **Nenhuma verde**, porque sumiria no gramado do sorteio.
- Cortes de cabelo: 4 (curto, comprido, careca, topete), na **mesma ordem** nos dois desenhos.

**Cuidados ao mudar:**
- A aparência escolhida pelo admin fica guardada no banco (coluna `players.avatar`) como **índices** dessas listas (`{ skin, hair, style, shirt }`). **Acrescente novas opções no FIM de cada lista**; se mudar a ordem ou diminuir uma lista, quem já escolheu pode ficar com outra aparência (valores inválidos voltam ao automático).
- Ao criar um corte de cabelo novo, atualize `HAIR_STYLES` e desenhe o corte **nos dois** arquivos (`Avatar.tsx` e `PlayerSprite.tsx`), na mesma posição da lista.
- Sem escolha, a aparência sai do nome do jogador (`autoLook`), então muda se a lista mudar de tamanho.
- O editor do admin ([src/components/AvatarEditor.tsx](src/components/AvatarEditor.tsx)) lê essas listas e se ajusta sozinho.

---

## 6. Cenário: caminhão, estádio, abertura

### Caminhão de lixo
[src/components/GarbageTruck.tsx](src/components/GarbageTruck.tsx): SVG desenhado por retângulos numa grade **61×26** (`TRUCK_GRID`). Cabine amarela, caçamba verde com o símbolo de reciclagem, três eixos e a traseira inclinada. As cores são constantes no topo do arquivo (`YELLOW`, `GREEN`, `GLASS` etc.).
- `TRUCK_HATCH` (`x: 53, width: 7`) marca, em pixels da grade, a **boca por onde os jogadores saem**: se redesenhar a traseira, ajuste esses números.
- Aparece no sorteio dos grupos e na abertura do site.

### Estádio do sorteio e da festa do campeão
Feito com **CSS** (sem imagem) em [src/app/globals.css](src/app/globals.css), montado por [src/components/stadium.tsx](src/components/stadium.tsx):

| Classe | O que desenha |
| --- | --- |
| `.scoreboard`, `.scoreboard-letter`, `.led` | Placar eletrônico com trama de lâmpadas e dígitos amarelos |
| `.stands`, `.stands-party` | Arquibancada com a torcida (quadradinhos coloridos pulando) |
| `.adboard` | Placas de publicidade ("Copinha dos Lixos") na beira do campo |
| `.turf`, `.zone`, `.spot` | Gramado listrado, área de cada grupo e a marca no chão de cada vaga |
| `.tunnel-wall`, `.tunnel-mouth` | Muro e boca do túnel |
| `.street`, `.truck-drive`, `.truck-idle` | Rua com faixa amarela e a chegada do caminhão |
| `.podium-block`, `.podium-1/2/3` | Degraus do pódio da festa do campeão |
| `.confetti`, `.confetti-layer` | Papel picado |
| `.rank-step`, `.rank-gold/silver/bronze` | Degraus do pódio do ranking (madeira dourada, aço, madeira de bronze) |
| `.pitch` | Faixa de gramado dos títulos de página |
| `.card` | Janela de menu azul com borda chanfrada |
| `.modal-backdrop`, `.modal-window` | Aviso de confirmação |

### Abertura do site
[src/components/Splash.tsx](src/components/Splash.tsx) e a seção "Abertura" de `globals.css`: céu noturno em faixas, estrelas, arquibancada, gramado em perspectiva, a bola e dois jogadores correndo com o caminhão de lixo no encalço, a reciclagem como emblema, o título caindo letra por letra e "APERTE START". É feita só de CSS e dos componentes de desenho acima. Aparece uma vez por visita e quem pede "reduzir movimento" no sistema não a vê.

### Efeito de TV de tubo
`body::after` em `globals.css` põe linhas de varredura bem leves sobre tudo. Para tirar, remova esse bloco.

---

## 7. Cores do tema

Definidas como variáveis em [src/app/globals.css](src/app/globals.css) (bloco `@theme inline`). Em classes do Tailwind viram `bg-night`, `text-accent` etc.

| Variável | Cor | Uso |
| --- | --- | --- |
| `--color-night` | `#04051a` | Contornos, fundo de campos e barras |
| `--color-canvas` | `#0b0e2e` | Fundo da tela |
| `--color-surface` | `#1a2670` | Janelas (`.card`) |
| `--color-wash` | `#2c3d9e` | Botões comuns, destaques |
| `--color-ink` | `#f6f6fa` | Texto principal |
| `--color-muted` | `#aebbee` | Texto secundário |
| `--color-faint` | `#7582c4` | Texto discreto e bordas de ficha |
| `--color-accent` | `#ffd42a` | Amarelo: item selecionado, títulos de seção, botão principal |
| `--color-accent-wash` | `#17702f` | Opção escolhida (verde do gramado) |
| `--color-danger` | `#ff7163` | Erros e ações que apagam |
| `--color-pitch` | `#1c9440` | Verde do gramado e dos ícones |
| `--color-bevel-light` / `--color-bevel-dark` | `#8ea4ff` / `#0c1450` | Chanfro das janelas e botões |

**Onde as cores também aparecem fora do CSS** (mude junto): `themeColor` em [src/app/layout.tsx](src/app/layout.tsx) (`#04051a`), `background_color` e `theme_color` em [src/app/manifest.ts](src/app/manifest.ts) (`#0b0e2e` e `#04051a`), [public/offline.html](public/offline.html), o fundo do favicon (`#1c9440`) e as constantes da imagem de compartilhamento ([src/app/opengraph-image.tsx](src/app/opengraph-image.tsx)).

---

## 8. Fotos dos jogadores

**Não são arquivos do projeto.** O admin envia a foto na tela do jogador; ela é recortada em quadrado, reduzida para **256×256 JPEG** no navegador e guardada **no banco de dados** (tabela `player_photos`, em base64). É servida em `/foto/<id>` com cache longo. Por isso funciona na hospedagem, onde o disco é apagado a cada deploy. Também dá para usar um link externo de imagem. Quem tem foto mostra a foto no lugar do boneco de pixels.

---

## 9. Checklist para trocar a identidade visual

Se for trocar o símbolo da marca (hoje a **bola** e a **reciclagem**), estes são todos os lugares:

1. **Favicon:** [src/app/icon.png](src/app/icon.png).
2. **Ícones de instalação:** [src/app/apple-icon.png](src/app/apple-icon.png) (180), [public/icon-192.png](public/icon-192.png), [public/icon-512.png](public/icon-512.png) e [public/icon-maskable-512.png](public/icon-maskable-512.png) (símbolo dentro dos 80% centrais).
3. **Imagem de compartilhamento:** [src/app/opengraph-image.tsx](src/app/opengraph-image.tsx).
4. **Marca na interface:** `BallIcon` e `RecycleIcon` em [src/components/icons.tsx](src/components/icons.tsx), usados por [src/components/TopBarBrand.tsx](src/components/TopBarBrand.tsx) (barra de cima), [src/components/ui.tsx](src/components/ui.tsx) (título da página inicial) e [src/components/Splash.tsx](src/components/Splash.tsx) (abertura).
5. **Caminhão:** o símbolo na caçamba (`RECYCLE_PIXELS` em [src/lib/sprite.ts](src/lib/sprite.ts), desenhado por [src/components/GarbageTruck.tsx](src/components/GarbageTruck.tsx)).
6. **Cores:** variáveis em `globals.css` e as cópias listadas na [seção 7](#7-cores-do-tema).
7. **Nome do app:** `name` e `short_name` em [src/app/manifest.ts](src/app/manifest.ts), `appleWebApp.title` e o `title` em [src/app/layout.tsx](src/app/layout.tsx), título de [public/offline.html](public/offline.html).
8. **Cache do app instalado:** se manteve os nomes dos PNGs, **aumente `VERSION` em [public/sw.js](public/sw.js)** (veja abaixo).

Depois de trocar, confira: aba do navegador, "adicionar à tela de início" no celular, o link colado no WhatsApp e a abertura do site.

---

## 10. Armadilhas

- **Cache do app instalado.** O `sw.js` guarda `.png`, `.svg` e `.woff` com "cache primeiro", e os PNGs de instalação mantêm o mesmo nome. Quem já abriu o app **continua vendo o ícone antigo** mesmo depois do deploy. Mude `const VERSION = "v1"` em `public/sw.js` (por exemplo, para `"v2"`): o service worker novo apaga o cache antigo.
- **Cache do WhatsApp.** O WhatsApp guarda a pré-visualização de um link por bastante tempo. Para testar a imagem nova, use um endereço diferente (por exemplo, acrescente `?teste=2`) ou o depurador de links do Facebook.
- **Cache do favicon.** O navegador demora a trocar o favicon: recarregue com Ctrl+F5 ou reabra o navegador.
- **Pixel art borrada.** Qualquer imagem de pixels precisa ser exportada e redimensionada **sem suavização**. Na interface, as grades de ícones já usam `shape-rendering="crispEdges"`.
- **Ícones só com `"#"` e `"."`.** Nas grades dos ícones, qualquer outro caractere é ignorado (some). Nas grades de **personagens**, as letras valem cor (veja a [seção 5](#5-jogadores-em-pixel-art)).
- **Fonte de títulos sem acento.** Texto novo na Press Start 2P sem passar por `<Arcade>` vai mostrar acentos estranhos.

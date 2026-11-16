# Arte-fonte

Arquivos originais usados para gerar ou orientar os sprites do jogo. Esta pasta
é versionada para que os geradores possam ser rodados em qualquer clone.

| Arquivo | Uso |
| --- | --- |
| `zombie-spritesheet.png` | Folha 8×4 recortada por `scripts/build-zombie-sprites.mjs` para `public/assets/sprites/zombie/`. |
| `references/burning-forest.jpg` | Referência visual de floresta em pixel art (não entra no build). |
| `references/waterfall.jpg` | Referência visual de cachoeira em pixel art (não entra no build). |

As folhas de Sandman, colonos e do lobo continuam em `raw/`, que não é
versionada por ser material de trabalho pesado. Os sprites já recortados em
`public/assets/sprites/` são versionados e usados pelo jogo.

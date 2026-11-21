# Sandman Database

API do jogo **Sandman — O Guardião da Floresta**. Guarda recordes, progresso por
jogador e a configuração publicada do jogo. Sem dependências externas: só Node.js.

## Publicar no Render

O código está versionado em `database/` dentro do repositório **Game.Cesar**
(ainda não tenho permissão para criar um repositório novo na conta). Para publicar:

1. Acesse [Render → New Web Service](https://dashboard.render.com/select-repo).
2. Selecione `eduardoosganascimento-beep/Game.Cesar`.
3. Em **Root Directory**, informe `database`.
4. Build: `npm install` · Start: `npm start` · Health check: `/health`.
5. Copie a URL (`https://sandman-database.onrender.com`) para o `API_BASE` do jogo.

O `database/render.yaml` também serve de blueprint caso você prefira um repo próprio.

## Rotas

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/health` | Status do serviço |
| `GET` | `/api/config` | Config atual do jogo (vida, dano, parry, arena) |
| `GET` | `/api/stats` | Total de recordes e jogadores |
| `GET` | `/api/scores?limit=10` | Ranking por tempo |
| `POST` | `/api/scores` | Enviar recorde |
| `GET` | `/api/progress/:player` | Ler progresso |
| `PUT` | `/api/progress/:player` | Salvar progresso |

### Exemplo: enviar recorde

```bash
curl -X POST https://sandman-database.onrender.com/api/scores \
  -H 'Content-Type: application/json' \
  -d '{"player":"Sand","chapter":3,"seconds":184,"difficulty":"normal"}'
```

### Exemplo: salvar progresso

```bash
curl -X PUT https://sandman-database.onrender.com/api/progress/Sand \
  -H 'Content-Type: application/json' \
  -d '{"chapter":2,"difficulty":"facil"}'
```

## Rodar local

```bash
npm start        # http://localhost:10000
npm run check    # valida a sintaxe
```

Dados ficam em `data/db.json` (criado automaticamente). Em produção, use um
volume persistente no Render para não perder os registros ao reiniciar.

## Contrato de dados

```json
{
  "scores": [
    { "id": "uuid", "player": "Sand", "chapter": 3, "seconds": 184, "difficulty": "normal", "createdAt": "ISO" }
  ],
  "progress": {
    "Sand": { "chapter": 2, "difficulty": "facil", "updatedAt": "ISO" }
  }
}
```

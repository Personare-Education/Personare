# Spec — App aponta para o backend e o site de produção

- **Branch:** `feature/production-urls`
- **Pedido:** o backend está no ar (`https://personare-backend.fly.dev`) e o site também
  (`https://personare-website.wandering-pond-32a8.workers.dev`). O app instalado precisa usar os dois, não
  `localhost`.

## Critérios de aceite

1. No app empacotado, `BACKEND_BASE_URL` é `https://personare-backend.fly.dev` e `PERSONARE_SITE_URL` é
   `https://personare-website.wandering-pond-32a8.workers.dev`.
2. Em desenvolvimento (`npm start`, `NODE_ENV=development`), os dois continuam em `http://localhost:3333` e
   `http://localhost:5173`, para trabalhar contra o backend e o site locais.
3. Nenhuma das URLs termina com `/`, porque as chamadas concatenam o caminho (`${BACKEND_BASE_URL}/auth/me`).

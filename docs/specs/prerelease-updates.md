# Spec — Atualização automática e "Testar pré-lançamentos"

- **Branch:** `feature/prerelease-updates` (2 de 2, sobre `fix/mac-traffic-lights`; leva o CHANGELOG dos dois)
- **Origem:** nenhuma versão do Personare chegou por atualização automática. O app consultava o
  `update.electronjs.org`, que só serve o "latest release" do GitHub e ignora pré-lançamentos, e todas as
  alphas saem como pré-lançamento. O usuário decidiu atualizar com base nos pré-lançamentos durante o beta,
  com uma opção nas Configurações, **ligada por padrão**.
- **Depende de:** o feed `/updates` do backend (`personare-backend`, `docs/specs/update-feed.md`) em produção.
- **Metodologia:** Spec Driven Development + TDD.

## Critérios de aceite

1. Configurações → Geral tem **Testar pré-lançamentos**, ligado por padrão, com a explicação: recebe as versões
   de teste (alphas) assim que saem; desligado, só as versões normais; vale na próxima vez que o app abrir.
2. A escolha fica salva (`app_settings.test_prereleases`, padrão ligado; bancos antigos ganham o padrão).
3. Ao abrir, o app procura atualizações no feed do backend: `…/updates/prerelease` com a opção ligada,
   `…/updates/stable` desligada (`updateFeedHost`), no mesmo formato que o `update.electronjs.org` usava.
4. Linux e macOS sem assinatura continuam sem atualização automática (limite da plataforma, não deste PR).

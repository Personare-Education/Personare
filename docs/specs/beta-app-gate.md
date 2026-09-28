# Spec — O app só abre para contas com o beta ativado

- **Branch:** `feature/beta-app-gate`
- **Pedido:** só beta testers podem usar o Personare. O app passa a exigir login **e** uma conta com o beta
  ativado; sem isso, ele mostra uma tela de login ou de ativação no lugar das rotas. O modo convidado
  deixa de contornar isso. O auto-update continua funcionando.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.
- **Contrapartes:** Study-Butler-Backend (`GET /beta/status`, `POST /beta/redeem`) e o site (`/ativar/`,
  lugar principal da ativação).

## Critérios de aceite

### Decisão (main, `beta.getGate()`)

1. **Sem token salvo** → `signed_out`.
2. **Com token e backend no ar:**
   - beta ativado → `activated` (online);
   - sem beta → `not_activated`.
   - Se a sessão ainda não estava carregada (o app abriu sem internet e a conexão voltou depois), ela é
     restaurada.
3. **Token recusado (401)** → `signed_out`, e a sessão local é apagada (token, cache do beta).
4. **Backend fora do ar / sem internet:**
   - se a última verificação **desta mesma conta** (o `sub` do JWT) disse "ativado" há **até 14 dias** →
     `activated` (offline);
   - senão → `offline` (tela "Sem conexão" com "Tentar de novo").
5. O cache da última verificação fica criptografado com `safeStorage` (como o token), em
   `userData/beta-status.enc`. É apagado ao sair da conta ou excluí-la. Um resgate de código bem-sucedido
   também o grava.
6. **Testes e2e:** só com `CI=e2e` **e** o binário genérico do Electron (`process.defaultApp`, como o
   Playwright abre o app) o bloqueio é pulado. O app instalado nunca é `defaultApp`, então essa variável
   sozinha não o destrava.

### Telas (renderer, `BetaGate` em volta do layout raiz)

7. **Carregando** → tela neutra, sem mostrar o app.
8. **`signed_out`** → "Entre para usar o Personare" + "Entrar com Google" (fluxo de login existente, com
   espera pelo retorno do navegador) e o link "Candidate-se ao beta" para o site.
9. **`not_activated`** → "Ative seu beta", "Conectado como <email>", campo de código (o mesmo de
   Configurações → Beta) e o botão "Ativar pelo site", que abre `<site>/ativar/`. Também "Usar outra conta"
   (sai da conta) e "Candidate-se ao beta". Depois de ativar, o app abre.
10. **`offline`** → "Sem conexão" + "Tentar de novo".
11. **`activated`** → o app normal.
12. Sair da conta ou excluí-la (em Configurações → Conta) volta a bloquear o app na hora.
13. A barra da janela (arrastar, minimizar e fechar) continua disponível nas telas de bloqueio.
14. Textos em pt-BR e inglês.

## Escolhas técnicas

- A decisão fica no **main**, perto do token (`safeStorage`) e do backend, e o renderer só a exibe.
- É um bloqueio de cliente: um app desktop de código aberto pode ser modificado por quem quiser. Serve para
  o beta fechado, não como proteção forte. Os instaladores continuam públicos no GitHub Releases.
- O auto-update (`update-electron-app`) roda no main desde o boot e não depende da tela desbloqueada.
- Com 14 dias de tolerância offline, quem estuda sem internet por alguns dias não fica trancado. Depois
  disso, o app precisa se conectar uma vez para confirmar o acesso.

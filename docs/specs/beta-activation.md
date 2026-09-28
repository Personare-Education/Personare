# Spec — Ativar o beta fechado com um código (Configurações → Beta)

- **Branch:** `feature/beta-serial-codes`
- **Pedido:** quem foi escolhido para o beta fechado recebe por email um código `PRSN-XXXX-XXXX-XXXX`, que é
  ativado **dentro do app, depois do login**, e fica preso para sempre àquela conta. O app mostra se a conta
  logada já ativou o beta.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.
- **Backend:** Study-Butler-Backend, `POST /beta/redeem` e `GET /beta/status` (autenticados; spec
  `docs/specs/beta-serial-codes.md` de lá). O site público (`personare-website`) cuida da candidatura.

## Critérios de aceite

1. O diálogo de Configurações ganha a categoria **Beta**, depois de Conta.
2. **Sem login:** a seção explica que é preciso entrar com a conta Google (em Conta) para ativar, sem campo
   de código.
3. **Logado, sem beta:** mostra "Não ativado", um campo "Código de ativação" (placeholder
   `PRSN-XXXX-XXXX-XXXX`) e o botão "Ativar", desabilitado com o campo vazio.
4. **Ativar:** chama o backend com o código digitado. Sucesso troca o formulário pelo estado ativado.
   Erros, em `role="alert"`, mantendo o que foi digitado:
   - `invalid_code` → código não encontrado, confira;
   - `code_already_used` → código já usado por outra conta;
   - `already_activated` → esta conta já tem o beta ativo;
   - `rate_limited` → muitas tentativas, espere um minuto;
   - `unreachable`/outros → não foi possível falar com o servidor.
5. **Logado, com beta:** mostra "Beta ativado", o código mascarado (`PRSN-••••-••••-AB12`) e a data da
   ativação. Sem campo de código.
6. **IPC:** namespace oRPC `beta` com `getStatus` (sem login → `null`) e `redeem({ code })` (sem login →
   `{ error: "not_logged_in" }`), usando o JWT guardado no main (`getAuthToken`), como Calendar e Drive.
7. Textos em pt-BR e inglês (i18next).

## Fora do escopo (por enquanto)

- **Bloquear o app** para quem não ativou. Dá para fazer depois: no boot, `beta.getStatus()` e, se não
  estiver ativado, o layout raiz mostra uma tela de ativação no lugar das rotas.
- **Candidatar-se pelo app:** o backend já aceita `source: "app"` e `userId` na candidatura, então basta
  uma rota autenticada e um botão nesta mesma seção.

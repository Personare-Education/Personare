# Spec — Tirar o que sobrou do boilerplate e atualizar a documentação

- **Pedido do usuário (2026-10-09):** seguir com as melhorias apontadas na revisão do projeto. Esta é a
  primeira frente: o que ainda era do boilerplate de origem (ver `Plan.md`).
- **Branch:** `feature/limpeza-boilerplate` (a primeira da pilha).

## Critérios de aceite

1. **Sem a página de exemplo:** a rota `/second`, o `NavigationMenu` que levava a ela, o
   `components/ui/navigation-menu.tsx` e o `ExternalLink` (só eles usavam) saem do código, e o
   `routeTree.gen.ts` é gerado de novo. As chaves `titleHomePage`, `titleSecondPage` e `documentation`
   saem dos nove idiomas.
2. **Sem testes de exemplo:** sai o `sum.test.ts`; o `example.test.ts` do e2e vira `smoke.test.ts`, com o
   mesmo teste.
3. **README do produto:** diz o que o Personare é, o que ele faz, a stack, a arquitetura, como rodar e
   testar, e como sai um release. Não aponta para workflows que não existem.
4. **Plan.md com status:** diz que as Fases 0 a 3 estão feitas, que o `PRODUCT.md` e as specs descrevem o
   produto de hoje, e marca como superada a decisão de que quiz, PDF e link não geram `ReviewItem`
   (Issue #77).
5. **PRODUCT.md:** os idiomas passam de "português e inglês" para os nove de hoje.

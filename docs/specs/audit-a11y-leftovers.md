# Spec — Acessibilidade: o que a segunda crítica achou e o detector não vê

- **Branch:** `feature/audit-a11y-leftovers`
- **Origem:** P1 da segunda crítica de design (`.impeccable/critique/2026-10-03T19-05-40Z__src.md`),
  avaliação B (contraste calculado pelos tokens).
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. **Anel de foco visível:** `--ring` passa a ser o azul da marca nos dois temas (cerca de 4,5:1 sobre
   o branco e 4,1:1 sobre o cartão escuro; antes 2,6:1 no claro), e o foco dos botões vira um anel
   sólido de 2px no lugar do halo a 30% (cerca de 1,3:1).
2. **Texto colorido sobre fundo da mesma cor:** os tokens `--brand-text`, `--success-text` e
   `--destructive-text` misturam a cor com o texto principal, mais escuro no claro e mais claro no
   escuro. Passam a usá-los o selo "Revisão hoje"/"atrasada" das linhas (antes ~4,0:1 e ~4,4:1), os
   números dos passos das boas-vindas e o ícone dos estados vazios (~4,0:1) e o "Correta" do editor de
   perguntas (~3,2:1). Todos ficam acima de 4,5:1.
3. **Idioma selecionado:** a opção ativa ganha fundo e borda no azul da marca, com o texto em
   `--brand-text` (antes só um cinza a ~1,07:1 do outro).
4. **Tema:** o botão vira **Tema escuro**, com texto visível e o estado ligado/desligado anunciado
   (`aria-pressed`) e visível.
   - **4b.** Sem tema salvo, o app segue o sistema, e a tela também: num Windows escuro, ela abre escura.
     Antes ela abria clara enquanto o Electron já estava escuro, e o primeiro clique em "Tema escuro"
     não fazia nada.
5. Textos em pt-BR e inglês.

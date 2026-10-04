# Spec — A identidade das telas de organizar

- **Branch:** `feature/organize-identity` (5 de 6 PRs empilhados, sobre `feature/quiz-immediate-feedback`)
- **Origem:** P2 da quarta crítica de design: dentro de um programa o título é só "Módulos" (e, dentro de um
  módulo, "Atividades"), sem a cor nem o ícone do programa, e o breadcrumb não começa em "Programas". Quem
  está ali não vê de cara em que programa está, e não tem um caminho de volta para a lista.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. A tela de um programa tem como título (`h1`) o **nome do programa**; a de um módulo, o **nome do módulo**.
2. Ao lado do título fica o selo do programa, com a cor e o ícone dele (os mesmos do cartão em Programas;
   sem cor escolhida, o azul da marca).
3. O breadcrumb começa em **"Programas"**, um link para a lista: "Programas › Programa" na tela do programa e
   "Programas › Programa › Módulo" na do módulo, com o programa como link.
4. O botão de criar continua à direita do título.

## Escolhas técnicas

- `OrganizeHeader` (`src/components/organize-header.tsx`) monta o breadcrumb (com o primeiro item fixo), o
  selo e o título; as duas rotas passam o nome, a cor, o ícone, os itens seguintes do breadcrumb e a ação.

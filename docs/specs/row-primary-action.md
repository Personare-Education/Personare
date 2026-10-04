# Spec — A ação principal de cada linha, com texto

- **Branch:** `feature/row-primary-action` (3 de 4 PRs empilhados, sobre `feature/key-hints`)
- **Origem:** P2 da terceira crítica de design: as ações das linhas eram só ícones, e o sentido dos ícones
  mudava conforme o tipo (▷ e lista num quiz; ⟳ e camadas num baralho). Quem chega não sabe o que cada um
  faz.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. Cada linha de Atividades e de Módulos mostra **uma** ação visível: a principal (a mesma do clique na
   linha), como botão com ícone e texto: "Iniciar revisão", "Responder quiz", "Ver PDF", "Abrir link",
   "Ver atividades".
2. Todas as outras ações vão para **Mais ações** ("⋯"): "Gerenciar flashcards", "Gerenciar perguntas",
   "Editar" e "Excluir".
3. O menu de clique direito continua com todas, na mesma ordem.
4. O botão da ação principal mantém o nome acessível igual ao texto.

## Escolhas técnicas

- `ActionableTableRow` mostra a primeira ação como botão com texto e as demais no menu "⋯". O campo
  `RowAction.inMenu` (do #164) deixa de ser necessário e sai.

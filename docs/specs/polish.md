# Spec — Polish: hierarquia de botões, navegação e profundidade dos cartões

- **Branch:** `feature/polish`
- **Origem:** etapa `polish` do plano da crítica de design (`.impeccable/critique/`): "hierarquia de
  botões achatada", "avaliações com contorno e tom por nível", "breadcrumb e seta de voltar
  duplicados", "brilho de borda fina com sombra larga".
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. **Avaliações com tom por nível:** os quatro botões deixam de ser pretos e iguais. Cada um leva um
   fundo leve e uma borda no tom do seu nível: Errei/Não entendi em vermelho (`--destructive`),
   Difícil/Com esforço em âmbar (`--warning`, token novo), Bom/Entendi em verde (`--success`) e
   Fácil/Fácil demais no azul da marca. O texto continua no tom principal, para manter o contraste.
2. **"Adicionar pergunta" e "Adicionar flashcard"** ficam discretos (`ghost`). **Concluir** continua
   o principal do rodapé.
3. **Sem seta de voltar duplicada:** Módulos e Atividades perdem o botão de seta. O breadcrumb (o
   programa, em Atividades) e a barra lateral (Programas) já levam de volta.
4. **Profundidade dos cartões na cor do programa:** o brilho sem deslocamento ao redor (`0 0 20px`) vira
   uma sombra com deslocamento para baixo e desfoque suave, no tom do programa. O anel de 1px continua.
   Vale para cards de programa, flashcards, itens de Hoje e os cartões de fim de sessão.

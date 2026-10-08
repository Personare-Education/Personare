# Spec — Idioma em ComboBox, mais idiomas, tamanhos S/M/L/XL e a versão nas Configurações

- **Pedido do usuário (2026-10-07):** "um seletor de idiomas com uma ComboBox do ShadcnUI, também quero uma
  bandeirazinha ao lado do idioma selecionado", os idiomas "Espanhol, Chinês Mandarim Simplificado, Árabe
  (o Shadcn disponibiliza componentes Right-to-Left), Francês, Alemão, Japonês e Coreano", "onde está a Label
  de Idioma coloque um ícone de Idioma", "os tamanhos de texto sigam o formato (S,M,L,XL)" e "a versão que o
  usuário está usando no rodapé do menu geral de configurações".
- **Metodologia:** Spec Driven Development + TDD, branch `feature/settings-language-text-size`, empilhada sobre
  `feature/ui-selection-scroll`.

## Critérios de aceite

1. **Idioma em ComboBox.** Em Configurações → Geral, o idioma é escolhido numa ComboBox do shadcn (a
   `combobox`): o botão mostra a bandeira e o nome do idioma escolhido; ao abrir, a lista tem a bandeira e o
   nome de cada idioma, com um campo para filtrar pelo nome. Escolher um idioma muda o app na hora e fica
   salvo, como antes.
2. **Ícone no título.** O título "Idioma" tem o ícone de idioma (`Languages`, do lucide) ao lado.
3. **Nove idiomas**, cada um com o nome na própria língua e a bandeira do país que o representa:
   English (EUA), Português (Brasil), Español (Espanha), 简体中文 (China), العربية (Arábia Saudita),
   Français (França), Deutsch (Alemanha), 日本語 (Japão) e 한국어 (Coreia do Sul). As bandeiras são SVG (o
   Windows não desenha emojis de bandeira).
4. **Traduções completas.** Cada idioma novo tem todas as chaves do inglês, com as mesmas variáveis
   (`{{count}}`, `{{name}}`...), e as formas de plural que a língua usa (o árabe tem seis; japonês, coreano e
   chinês, uma).
5. **Árabe da direita para a esquerda.** Com o árabe, o documento fica `dir="rtl"` e os componentes do
   shadcn seguem a direção (o `DirectionProvider` e as classes lógicas da migração `rtl` do shadcn). Os outros
   idiomas ficam `ltr`. A direção vale também ao abrir o app com o árabe salvo.
6. **Datas no idioma.** O calendário e as datas usam o locale do date-fns do idioma escolhido.
7. **Tamanho do texto S, M, L, XL.** As quatro opções aparecem como **S**, **M**, **L** e **XL** (90%, 100%,
   112,5%, 125%, como antes); o leitor de tela continua lendo o nome por extenso ("Pequeno", "Padrão"...).
8. **Versão no rodapé.** O rodapé das Configurações mostra a versão do app em uso ("Versão 0.1.0-alpha.11").

## Fora do escopo

- Os prompts de IA (importar programa e quiz) continuam em inglês para os idiomas novos; o português
  continua com o prompt em português.

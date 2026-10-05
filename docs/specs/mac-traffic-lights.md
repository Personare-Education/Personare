# Spec — Os botões da janela no macOS alinhados

- **Branch:** `fix/mac-traffic-lights`
- **Origem:** no macOS, os botões de fechar, minimizar e maximizar (o "semáforo") ficavam colados no canto da
  janela, em `trafficLightPosition: { x: 5, y: 5 }`, e no macOS recente o canto arredondado da janela encosta
  no botão vermelho. A faixa de cima, no macOS, tinha só 16 px (um espaço vazio com `p-2`), menos que os
  botões, então eles invadiam a linha do logo.
- **Metodologia:** Spec Driven Development + TDD.

## Critérios de aceite

1. No macOS, a faixa de cima da janela tem uma altura fixa (`MAC_TITLE_BAR_HEIGHT`, 44 px), vazia e arrastável.
2. Os botões ficam centralizados verticalmente nessa faixa e afastados do canto
   (`macTrafficLightPosition()`), longe da curva da janela e acima da linha do logo.
3. A posição dos botões e a altura da faixa vêm da mesma constante, para não se desencontrarem.
4. Windows e Linux não mudam.

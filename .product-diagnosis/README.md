# Diagnóstico de produto

Saída da skill `diagnostico-de-produto`. Versionado de propósito: o valor está
na COMPARAÇÃO entre execuções — um portão marcado para 15/ago só significa algo
contra o baseline medido em 08/ago.

    runs/<carimbo>/diagnosis.json   fotografia imutável de uma execução
    runs/<carimbo>/dashboard.html   renderização daquele JSON
    latest.json                     cópia da execução mais recente
    state/decisions.json            decisões humanas — a skill LÊ, nunca escreve
    state/experiments.json          experimentos em curso — idem

`state/` é o que sobrevive às execuções. Se a skill escrevesse ali, cada
re-execução sobrescreveria julgamento humano.

Nenhum arquivo contém credencial: `evidence[].source.query` guarda o SQL, não a
string de conexão. Verificado antes de versionar.

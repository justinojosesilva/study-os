# Som ambiente das sessões

Solte os arquivos de áudio aqui e eles aparecem sozinhos no player — não há
manifesto para editar nem build para refazer. A listagem é lida a cada
requisição por `/api/ambient-tracks`.

```
public/audio/
  foco/       ← toca durante o tempo de foco
  descanso/   ← toca durante o descanso
```

Formatos aceitos: `.mp3`, `.m4a`, `.ogg`, `.oga`, `.wav`, `.flac`, `.aac`, `.opus`.

O nome do arquivo (sem a extensão) é o que aparece como "tocando agora", então
vale nomear de forma legível — `chuva-e-piano.mp3` em vez de `track01.mp3`.

As faixas tocam embaralhadas, em loop, com crossfade de 4 segundos entre elas.

## Sobre licenciamento

Use apenas faixas que você tem direito de usar: domínio público, Creative
Commons compatível, royalty-free comprado, ou algo que você mesmo produziu.

Áudio extraído de YouTube, Spotify e afins **não** entra aqui — além de violar
os termos dessas plataformas, o arquivo iria junto no deploy, o que torna a
publicação uma redistribuição da obra.

## Peso do repositório

Áudio é pesado. Se a pasta passar de algumas dezenas de MB, vale mover para um
bucket (S3, R2) e servir por URL, ou marcar a pasta no `.gitignore` e enviar os
arquivos direto para o servidor.

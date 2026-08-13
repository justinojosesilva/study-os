import { Sparkles } from "lucide-react";
import type { ConsumoDetalhado } from "@/domain/ai/usage";

/**
 * Quanto a IA custou e quanto falta para o teto.
 *
 * Sem esta tela a cota só se manifestava quebrando: a pessoa clicava em gerar
 * e recebia "limite atingido" sem nunca ter visto o número subir. O painel
 * existe para o teto ser previsível, não uma surpresa.
 */

const ROTULO: Record<string, string> = {
  gapAnalysis: "Análise de lacunas",
  careerImport: "Importar currículo",
  examGen: "Provas",
  flashcardGen: "Flashcards",
  githubProjects: "Projetos do GitHub",
  quizGen: "Questionários",
  resume: "Gerar currículo",
  roadmap: "Roadmap",
  topicPhases: "Agrupar em fases",
  tutor: "Tutor",
  weekStrategy: "Estratégia da semana",
};

function dolar(micros: number): string {
  return `US$ ${(micros / 1_000_000).toFixed(2)}`;
}

function Barra({ usado, teto, rotulo }: { usado: number; teto: number; rotulo: string }) {
  const pct = teto > 0 ? Math.min(100, (usado / teto) * 100) : 0;
  // Só muda de cor perto do fim. Barra vermelha em 30% de uso treina a pessoa a
  // ignorar a cor justamente quando ela passar a significar alguma coisa.
  const cor = pct >= 90 ? "bg-red-600" : pct >= 70 ? "bg-warning" : "bg-certificacao";
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted">{rotulo}</span>
        <span className="tabular-nums text-muted">
          {dolar(usado)} <span className="text-faint">de {dolar(teto)}</span>
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full ${cor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function AiUsagePanel({ consumo }: { consumo: ConsumoDetalhado }) {
  const { dia, mes, chamadasHoje, tetoDia, tetoMes, tetoProprio, porEndpoint } = consumo;

  return (
    <section className="mt-8 rounded-xl border border-line bg-surface px-4 py-4">
      <h2 className="mb-1 flex items-center gap-2 text-base font-medium">
        <Sparkles size={16} className="text-certificacao" />
        Uso de IA
      </h2>
      <p className="mb-4 text-xs text-muted">
        {chamadasHoje === 0
          ? "Nenhuma chamada nas últimas 24h."
          : `${chamadasHoje} ${chamadasHoje === 1 ? "chamada" : "chamadas"} nas últimas 24h.`}{" "}
        Os tetos são por pessoa e reabrem por janela móvel, não por virada de mês.
        {tetoProprio && " Esta conta tem limite próprio, diferente do padrão."}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Barra usado={dia} teto={tetoDia} rotulo="Últimas 24h" />
        <Barra usado={mes} teto={tetoMes} rotulo="Últimos 30 dias" />
      </div>

      {porEndpoint.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-line pt-3">
          {porEndpoint.map((e) => (
            <li key={e.endpoint} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate">{ROTULO[e.endpoint] ?? e.endpoint}</span>
              <span className="shrink-0 tabular-nums text-muted">
                {dolar(e.micros)}{" "}
                <span className="text-faint">
                  · {e.chamadas} {e.chamadas === 1 ? "chamada" : "chamadas"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

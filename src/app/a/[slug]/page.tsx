import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolvePublicLesson } from "@/domain/lessons/repository";
import { LessonContent } from "@/app/_components/LessonContent";
import { readingMinutes, titleFromMarkdown } from "@/lib/headings";

/**
 * Aula compartilhada por link.
 *
 * Mesma costura de /r/[slug]: `resolvePublicLesson` é a ÚNICA leitura que fura
 * a RLS, filtrada a linhas publicadas. Nada mais é carregado — nem notas, nem
 * progresso, nem o tópico dentro da meta. Quem abre o link vê o material, e o
 * material é tudo que ele vê.
 *
 * Sem o shell do app de propósito: quem recebe o link não tem conta, e uma
 * barra lateral com "Dashboard" e "Agenda" só ofereceria portas fechadas.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const aula = await resolvePublicLesson(slug);
  if (!aula) return { title: "Aula" };
  return {
    title: `${titleFromMarkdown(aula.content) ?? aula.title} — Latis Skills`,
    description: `${aula.topicTitle} · leitura de ~${readingMinutes(aula.content)} min`,
    // Link compartilhado é para quem recebeu, não para o índice do Google. Mesma
    // decisão já tomada no currículo público.
    robots: { index: false },
  };
}

export default async function PublicLessonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const aula = await resolvePublicLesson(slug);
  if (!aula) notFound();

  const minutos = readingMinutes(aula.content);
  // O markdown quase sempre traz o próprio H1, e ele é melhor que a coluna
  // `title` — que guarda o nome do arquivo de origem ("aula-01-quarkus-build-
  // time"). Quando existe, deixo o conteúdo se apresentar e não desenho um
  // título por cima; seriam dois, com o pior em destaque.
  const h1 = titleFromMarkdown(aula.content);

  return (
    <main className="min-h-screen bg-canvas px-5 py-10">
      <article className="mx-auto w-full max-w-3xl">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-faint">
          {aula.topicTitle}
          {aula.kind === "lab" && " · roteiro prático"}
        </p>
        {!h1 && <h1 className="mb-2 text-2xl font-medium tracking-tight">{aula.title}</h1>}
        <p className="mb-8 text-xs text-faint">
          leitura estimada em {minutos} min · atualizada em{" "}
          {aula.updatedAt.toLocaleDateString("pt-BR")}
        </p>

        {/* `sections` fica FALSO aqui: seções dobráveis existem para quem volta
            à mesma aula muitas vezes e quer pular ao ponto. Quem abre um link
            compartilhado está na primeira leitura — dobrar tudo esconderia
            justamente o que ele veio ver. */}
        <LessonContent content={aula.content} />

        <p className="mt-12 border-t border-line pt-4 text-center text-xs text-faint">
          Feito com <span className="font-medium text-muted">Latis Skills</span>
        </p>
      </article>
    </main>
  );
}

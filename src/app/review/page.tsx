import { scoped } from "@/domain/auth";
import { listDueCards } from "@/domain/reviews/repository";
import { getReviewStats } from "@/domain/reviews/stats";
import { ReviewSession } from "@/app/_components/ReviewSession";
import { ReviewStats } from "@/app/_components/ReviewStats";
import { Breadcrumbs } from "@/app/_components/Breadcrumbs";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  return scoped(async (ownerId) => {
  const [queue, stats] = await Promise.all([
    listDueCards(ownerId),
    getReviewStats(ownerId),
  ]);

  return (
    <main className="mx-auto w-full max-w-xl px-5 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Revisão" }]} />

      <h1 className="mb-6 text-xl font-medium">Revisão de hoje</h1>

      <ReviewSession
        queue={queue.map((q) => ({
          flashcardId: q.flashcardId,
          front: q.front,
          back: q.back,
          topicTitle: q.topicTitle,
          goalTitle: q.goalTitle,
        }))}
      />

      {queue.length === 0 && <ReviewStats stats={stats} />}
    </main>
  );
  });
}

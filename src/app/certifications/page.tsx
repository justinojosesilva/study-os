import { Award } from "lucide-react";
import { scoped } from "@/domain/auth";
import { listCertifications, type CertificationView } from "@/domain/certifications/repository";
import { listActiveGoalOptions } from "@/domain/goals/repository";
import { Breadcrumbs } from "@/app/_components/Breadcrumbs";
import { CertificationForm } from "@/app/_components/CertificationForm";
import { CertCard } from "@/app/_components/CertCard";
import { EmptyState } from "@/app/_components/EmptyState";

export const dynamic = "force-dynamic";

const GROUPS: { title: string; statuses: CertificationView["status"][] }[] = [
  { title: "Em andamento", statuses: ["scheduled", "planned"] },
  { title: "Conquistadas", statuses: ["passed"] },
  { title: "Encerradas", statuses: ["failed", "expired"] },
];

export default async function CertificationsPage() {
  return scoped(async (ownerId) => {
    const [certs, goals] = await Promise.all([
      listCertifications(ownerId),
      listActiveGoalOptions(ownerId),
    ]);

    const passed = certs.filter((c) => c.status === "passed").length;

    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-12">
        <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Certificações" }]} />

        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-medium">
              <Award size={20} className="text-certificacao" />
              Certificações
            </h1>
            <p className="mt-1 text-sm text-muted">
              {certs.length === 0
                ? "Acompanhe provas, prazos e credenciais da sua carreira."
                : `${passed} conquistada${passed === 1 ? "" : "s"} · ${certs.length} no total.`}
            </p>
          </div>
          <CertificationForm goals={goals} />
        </div>

        {certs.length === 0 ? (
          <EmptyState
            icon={Award}
            title="Nenhuma certificação ainda"
            hint="Adicione uma prova que você quer tirar — ou vincule a um objetivo para acompanhar sua prontidão."
          />
        ) : (
          <div className="flex flex-col gap-8">
            {GROUPS.map((group) => {
              const items = certs.filter((c) => group.statuses.includes(c.status));
              if (items.length === 0) return null;
              return (
                <section key={group.title}>
                  <h2 className="mb-3 text-sm font-medium text-muted">
                    {group.title}
                    <span className="ml-1.5 text-faint">{items.length}</span>
                  </h2>
                  <ul className="flex flex-col gap-3">
                    {items.map((cert) => (
                      <CertCard key={cert.id} cert={cert} goals={goals} />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </main>
    );
  });
}

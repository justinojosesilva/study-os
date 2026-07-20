import { Briefcase, GraduationCap, BadgeCheck, type LucideIcon } from "lucide-react";

export type Category = "faculdade" | "profissional" | "certificacao";

type CategoryMeta = {
  label: string;
  Icon: LucideIcon;
  /** text color utility */
  text: string;
  /** soft background utility (badge) */
  soft: string;
  /** progress-bar fill utility */
  bar: string;
};

export const CATEGORY: Record<Category, CategoryMeta> = {
  profissional: {
    label: "Profissional",
    Icon: Briefcase,
    text: "text-profissional",
    soft: "bg-profissional-soft",
    bar: "bg-profissional",
  },
  faculdade: {
    label: "Faculdade",
    Icon: GraduationCap,
    text: "text-faculdade",
    soft: "bg-faculdade-soft",
    bar: "bg-faculdade",
  },
  certificacao: {
    label: "Certificação",
    Icon: BadgeCheck,
    text: "text-certificacao",
    soft: "bg-certificacao-soft",
    bar: "bg-certificacao",
  },
};

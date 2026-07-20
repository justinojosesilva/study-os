import {
  BookOpen,
  FileText,
  Video,
  GraduationCap,
  Newspaper,
  Link as LinkIcon,
  type LucideIcon,
} from "lucide-react";

export type MaterialType = "book" | "pdf" | "video" | "course" | "article" | "link";

type MaterialMeta = { label: string; Icon: LucideIcon };

export const MATERIAL_TYPE: Record<MaterialType, MaterialMeta> = {
  book: { label: "Livro", Icon: BookOpen },
  pdf: { label: "PDF", Icon: FileText },
  video: { label: "Vídeo", Icon: Video },
  course: { label: "Curso", Icon: GraduationCap },
  article: { label: "Artigo", Icon: Newspaper },
  link: { label: "Link", Icon: LinkIcon },
};

export const MATERIAL_TYPE_OPTIONS: { value: MaterialType; label: string }[] = (
  Object.keys(MATERIAL_TYPE) as MaterialType[]
).map((value) => ({ value, label: MATERIAL_TYPE[value].label }));

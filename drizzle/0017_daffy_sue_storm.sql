-- Busca das anotações: troca a configuração `portuguese` por `pt_unaccent`.
--
-- `pt_unaccent` é a `portuguese` com o unaccent antes do stemmer. Medido antes
-- de escrever: o stemmer português NÃO junta "injeção"/"injeções" ('injeçã' vs
-- 'injeçõ') nem "revisão"/"revisar" — e o unaccent não muda isso. O que ele
-- resolve é digitar sem acento, que é o caso que aparece de verdade:
-- "conteudo" passa a encontrar "conteúdo".
--
-- O índice é derrubado ANTES da configuração ser recriada porque um índice que
-- dependesse dela impediria o DROP.
DROP INDEX IF EXISTS "notes_fts_idx";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
DROP TEXT SEARCH CONFIGURATION IF EXISTS pt_unaccent;--> statement-breakpoint
CREATE TEXT SEARCH CONFIGURATION pt_unaccent (COPY = portuguese);--> statement-breakpoint
ALTER TEXT SEARCH CONFIGURATION pt_unaccent
  ALTER MAPPING FOR hword, hword_part, word
  WITH unaccent, portuguese_stem;--> statement-breakpoint
CREATE INDEX "notes_fts_idx" ON "notes" USING gin (to_tsvector('pt_unaccent', "title" || ' ' || "content"));

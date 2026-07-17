-- ============================================================
-- Statistics DB — Migration: Enable pgvector extension
-- Proyecto: ClubLab v2026 — Statistics_DB
-- Propósito: Activa el soporte de almacenamiento vectorial (embeddings)
--            necesario para búsquedas semánticas y el motor de IA.
--
-- FASE 7 — TAREA 6.3
--
-- EJECUTAR EN: Supabase Federation Project (Statistics_DB)
-- ============================================================

-- Enable the pgvector extension (provided natively by Supabase)
CREATE EXTENSION IF NOT EXISTS vector;

COMMENT ON EXTENSION vector IS
  'Extensión pgvector para el manejo y búsqueda semántica de vectores de embeddings de IA';

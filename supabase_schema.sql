-- ==============================================================================
-- SCHEMA SUPABASE - APPLICATION D'ORGANISATION MÉDICALE (LOCAL-FIRST & SYNC)
-- Tables: events (Agenda) & tasks (To-Do List Persistante)
-- Row Level Security (RLS) & Politiques d'accès par utilisateur
-- Index d'optimisation de requêtes & Synchronisation temps réel
-- ==============================================================================

-- 1. Extension UUID (si nécessaire)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Fonction utilitaire pour la mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- TABLE: events (Agenda / Emploi du temps médical)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    alarms INTEGER[] NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- Index de performance pour les requêtes d'agenda
CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_start_end ON public.events(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_events_updated_at ON public.events(updated_at);
CREATE INDEX IF NOT EXISTS idx_events_sync ON public.events(user_id, updated_at, is_deleted);

-- Trigger pour updated_at automatique
DROP TRIGGER IF EXISTS trigger_events_updated_at ON public.events;
CREATE TRIGGER trigger_events_updated_at
    BEFORE UPDATE ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Activer Row Level Security (RLS)
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour 'events'
DROP POLICY IF EXISTS "Les utilisateurs gèrent uniquement leurs propres événements - SELECT" ON public.events;
CREATE POLICY "Les utilisateurs gèrent uniquement leurs propres événements - SELECT"
    ON public.events FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Les utilisateurs insèrent uniquement leurs propres événements - INSERT" ON public.events;
CREATE POLICY "Les utilisateurs insèrent uniquement leurs propres événements - INSERT"
    ON public.events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Les utilisateurs mettent à jour uniquement leurs propres événements - UPDATE" ON public.events;
CREATE POLICY "Les utilisateurs mettent à jour uniquement leurs propres événements - UPDATE"
    ON public.events FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Les utilisateurs suppriment uniquement leurs propres événements - DELETE" ON public.events;
CREATE POLICY "Les utilisateurs suppriment uniquement leurs propres événements - DELETE"
    ON public.events FOR DELETE
    USING (auth.uid() = user_id);


-- ------------------------------------------------------------------------------
-- TABLE: tasks (To-Do List Globale Persistante & Indépendante du temps)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#10B981',
    is_completed BOOLEAN NOT NULL DEFAULT false,
    order_index INTEGER NOT NULL DEFAULT 0,
    alarm_time TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- Index de performance pour les tâches
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_order ON public.tasks(order_index ASC);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON public.tasks(updated_at);
CREATE INDEX IF NOT EXISTS idx_tasks_sync ON public.tasks(user_id, updated_at, is_deleted);

-- Trigger pour updated_at automatique
DROP TRIGGER IF EXISTS trigger_tasks_updated_at ON public.tasks;
CREATE TRIGGER trigger_tasks_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Activer Row Level Security (RLS)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour 'tasks'
DROP POLICY IF EXISTS "Les utilisateurs gèrent uniquement leurs propres tâches - SELECT" ON public.tasks;
CREATE POLICY "Les utilisateurs gèrent uniquement leurs propres tâches - SELECT"
    ON public.tasks FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Les utilisateurs insèrent uniquement leurs propres tâches - INSERT" ON public.tasks;
CREATE POLICY "Les utilisateurs insèrent uniquement leurs propres tâches - INSERT"
    ON public.tasks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Les utilisateurs mettent à jour uniquement leurs propres tâches - UPDATE" ON public.tasks;
CREATE POLICY "Les utilisateurs mettent à jour uniquement leurs propres tâches - UPDATE"
    ON public.tasks FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Les utilisateurs suppriment uniquement leurs propres tâches - DELETE" ON public.tasks;
CREATE POLICY "Les utilisateurs suppriment uniquement leurs propres tâches - DELETE"
    ON public.tasks FOR DELETE
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- ACTIVATION DE SUPABASE REALTIME (Pour sync iPhone <-> iPad instantanée)
-- ------------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;

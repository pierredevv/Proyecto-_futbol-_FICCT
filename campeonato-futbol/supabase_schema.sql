-- 1. Limpieza segura (evita error 42P07)
DROP TABLE IF EXISTS public.matches CASCADE;
DROP TABLE IF EXISTS public.players CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;
DROP TABLE IF EXISTS public.tournaments CASCADE;

-- 2. Esquema actualizado FICCT
CREATE TABLE public.tournaments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    format TEXT NOT NULL CHECK (format IN ('liga', 'eliminacion', 'grupos')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.teams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    number INTEGER,
    position TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.matches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
    home_team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    away_team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    round TEXT NOT NULL,
    home_goals INTEGER,
    away_goals INTEGER,
    is_played BOOLEAN DEFAULT false NOT NULL,
    match_date DATE,
    match_time TIME,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Habilitar RLS
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- 4. Políticas (limpias y sin conflictos)
CREATE POLICY "Public read tournaments" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Owner insert tournaments" ON public.tournaments FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Owner update tournaments" ON public.tournaments FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Owner delete tournaments" ON public.tournaments FOR DELETE USING (auth.uid() = creator_id);

CREATE POLICY "Public read teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Owner manage teams" ON public.teams FOR ALL USING (
    EXISTS (SELECT 1 FROM public.tournaments WHERE id = tournament_id AND creator_id = auth.uid())
);

CREATE POLICY "Public read players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Owner manage players" ON public.players FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.teams t
        JOIN public.tournaments tr ON t.tournament_id = tr.id
        WHERE t.id = team_id AND tr.creator_id = auth.uid()
    )
);

CREATE POLICY "Public read matches" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Owner manage matches" ON public.matches FOR ALL USING (
    EXISTS (SELECT 1 FROM public.tournaments WHERE id = tournament_id AND creator_id = auth.uid())
);

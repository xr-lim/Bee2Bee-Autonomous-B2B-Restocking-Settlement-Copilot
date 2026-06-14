CREATE TABLE IF NOT EXISTS public.ai_analysis_preferences (
  id TEXT PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  mode TEXT NOT NULL DEFAULT 'manual' CHECK (
    mode IN ('manual', 'on-login', 'scheduled')
  ),
  cadence TEXT NOT NULL DEFAULT 'daily' CHECK (
    cadence IN ('daily', 'weekly', 'monthly')
  ),
  scope TEXT NOT NULL DEFAULT 'both' CHECK (
    scope IN ('threshold', 'restock', 'both')
  ),
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.ai_analysis_preferences (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS set_ai_analysis_preferences_updated_at
ON public.ai_analysis_preferences;

CREATE TRIGGER set_ai_analysis_preferences_updated_at
BEFORE UPDATE ON public.ai_analysis_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

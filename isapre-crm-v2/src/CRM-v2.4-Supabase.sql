-- Tu Salud Primero CRM v2.4 — ejecutar una sola vez en Supabase SQL Editor.
-- Las actividades no se exponen mediante consultas directas desde el navegador.
BEGIN;
CREATE TABLE IF NOT EXISTS public.lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id),
  kind text NOT NULL CHECK (kind IN ('nota','contacto','seguimiento')),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 2 AND 2000),
  followup_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seguimiento_requiere_fecha CHECK (kind <> 'seguimiento' OR followup_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS lead_activities_lead_date_idx ON public.lead_activities (lead_id, created_at DESC);
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.lead_activities FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.crm_get_lead_activities(p_lead_id uuid)
RETURNS TABLE(id uuid, lead_id uuid, author_id uuid, kind text, body text, followup_at timestamptz, completed_at timestamptz, created_at timestamptz, author_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = p_lead_id AND (
      public.is_admin() OR EXISTS (
        SELECT 1 FROM public.user_permissions up WHERE up.user_id=auth.uid()
        AND (up.view_all_leads OR (up.view_assigned_leads AND l.assigned_to=auth.uid()))
      )
    )
  ) THEN RAISE EXCEPTION 'No autorizado para consultar este prospecto' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT a.id,a.lead_id,a.author_id,a.kind,a.body,a.followup_at,a.completed_at,a.created_at,
    coalesce(nullif(p.full_name,''),'Usuario autorizado')::text
    FROM public.lead_activities a LEFT JOIN public.profiles p ON p.id=a.author_id
    WHERE a.lead_id=p_lead_id ORDER BY a.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.crm_add_lead_activity(p_lead_id uuid,p_kind text,p_body text,p_followup_at timestamptz DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.leads l WHERE l.id=p_lead_id AND (
      public.is_admin() OR EXISTS (
        SELECT 1 FROM public.user_permissions up WHERE up.user_id=auth.uid()
        AND up.manage_assigned_leads AND l.assigned_to=auth.uid()
      )
    )
  ) THEN RAISE EXCEPTION 'No autorizado para registrar gestiones' USING ERRCODE='42501'; END IF;
  IF p_kind NOT IN ('nota','contacto','seguimiento') OR p_body IS NULL OR char_length(btrim(p_body)) NOT BETWEEN 2 AND 2000
    OR (p_kind='seguimiento' AND p_followup_at IS NULL)
  THEN RAISE EXCEPTION 'Datos de gestión no válidos' USING ERRCODE='22023'; END IF;
  INSERT INTO public.lead_activities(lead_id,author_id,kind,body,followup_at)
  VALUES (p_lead_id,auth.uid(),p_kind,btrim(p_body),CASE WHEN p_kind='seguimiento' THEN p_followup_at ELSE NULL END)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.crm_complete_followup(p_activity_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_lead_id uuid;
BEGIN
  SELECT a.lead_id INTO v_lead_id FROM public.lead_activities a WHERE a.id=p_activity_id AND a.kind='seguimiento';
  IF v_lead_id IS NULL OR auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.leads l WHERE l.id=v_lead_id AND (
      public.is_admin() OR EXISTS (
        SELECT 1 FROM public.user_permissions up WHERE up.user_id=auth.uid()
        AND up.manage_assigned_leads AND l.assigned_to=auth.uid()
      )
    )
  ) THEN RAISE EXCEPTION 'No autorizado para completar seguimiento' USING ERRCODE='42501'; END IF;
  UPDATE public.lead_activities SET completed_at=now() WHERE id=p_activity_id AND completed_at IS NULL;
END $$;

REVOKE ALL ON FUNCTION public.crm_get_lead_activities(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.crm_add_lead_activity(uuid,text,text,timestamptz) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.crm_complete_followup(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_get_lead_activities(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_add_lead_activity(uuid,text,text,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_complete_followup(uuid) TO authenticated;
COMMIT;

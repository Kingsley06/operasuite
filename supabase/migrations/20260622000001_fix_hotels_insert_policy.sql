-- Simplify hotels INSERT policy — just require authentication
DROP POLICY IF EXISTS "New user can create hotel" ON public.hotels;
DROP POLICY IF EXISTS "Authenticated can create hotel" ON public.hotels;

CREATE POLICY "Authenticated can create hotel" ON public.hotels
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

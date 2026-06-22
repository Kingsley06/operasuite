-- Allow authenticated users with no hotel yet to create one (onboarding flow)
CREATE POLICY "New user can create hotel" ON public.hotels
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND hotel_id IS NOT NULL
    )
  );

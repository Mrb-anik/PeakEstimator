-- 1. Ensure the bucket exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('company-logos', 'company-logos', true) 
ON CONFLICT (id) DO NOTHING;

-- 2. Drop any conflicting or old policies on this bucket
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads of individual files" ON storage.objects;

-- 3. Allow signed-in users to upload logos
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'company-logos');

-- 4. Allow signed-in users to update logos
CREATE POLICY "Allow authenticated updates" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'company-logos');

-- 5. Allow public to READ files, but NOT list the bucket (fixes the warning while keeping images visible)
CREATE POLICY "Allow public reads of individual files" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'company-logos' AND auth.role() = 'anon');

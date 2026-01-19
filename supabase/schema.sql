-- Property Photo Map Database Schema
-- Run this in Supabase SQL Editor to create the required tables and policies

-- Photos table
CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'photos',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  position_source TEXT NOT NULL DEFAULT 'manual' CHECK (position_source IN ('exif', 'manual')),
  bearing SMALLINT CHECK (bearing >= 0 AND bearing <= 360),
  bearing_source TEXT CHECK (bearing_source IN ('exif', 'manual') OR bearing_source IS NULL),
  date_taken TIMESTAMPTZ,
  date_source TEXT NOT NULL DEFAULT 'manual' CHECK (date_source IN ('exif', 'manual')),
  title TEXT,
  description TEXT,
  media_type TEXT NOT NULL DEFAULT 'photo' CHECK (media_type IN ('photo', 'video')),
  duration REAL,
  thumbnail_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for user queries
CREATE INDEX IF NOT EXISTS photos_user_id_idx ON photos(user_id);

-- Create index for date-based queries
CREATE INDEX IF NOT EXISTS photos_date_taken_idx ON photos(date_taken);

-- Create index for location-based queries
CREATE INDEX IF NOT EXISTS photos_location_idx ON photos(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own photos
CREATE POLICY "Users can view own photos"
  ON photos FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own photos
CREATE POLICY "Users can insert own photos"
  ON photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own photos
CREATE POLICY "Users can update own photos"
  ON photos FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own photos
CREATE POLICY "Users can delete own photos"
  ON photos FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at on photo updates
DROP TRIGGER IF EXISTS update_photos_updated_at ON photos;
CREATE TRIGGER update_photos_updated_at
  BEFORE UPDATE ON photos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STORAGE BUCKET SETUP
-- ============================================================================

-- Create the storage bucket (if it doesn't exist, create manually in dashboard)
-- Settings: Public bucket OFF, File size limit 50MB, MIME types: images and videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('photos', 'photos', false, 52428800, ARRAY['image/*', 'video/mp4', 'video/quicktime', 'video/webm'])
ON CONFLICT (id) DO NOTHING;

-- Storage Policy: Users can upload to their own folder
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage Policy: Any authenticated user can read photos
CREATE POLICY "Authenticated users can read photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'photos');

-- Storage Policy: Users can delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

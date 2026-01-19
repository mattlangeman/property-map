-- Add video support to photos table
-- Adds media_type discriminator, video duration, and thumbnail path

ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'photo',
  ADD COLUMN IF NOT EXISTS duration REAL,
  ADD COLUMN IF NOT EXISTS thumbnail_path TEXT;

-- Add comment for documentation
COMMENT ON COLUMN photos.media_type IS 'Type of media: photo or video';
COMMENT ON COLUMN photos.duration IS 'Video duration in seconds (null for photos)';
COMMENT ON COLUMN photos.thumbnail_path IS 'Storage path for video thumbnail (null for photos)';

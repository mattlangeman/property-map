import { z } from 'zod';

/**
 * Schema for EXIF data extracted from photos.
 * All fields are optional since EXIF data may be missing or incomplete.
 */
export const ExifDataSchema = z.object({
	latitude: z.number().min(-90).max(90).nullable().optional(),
	longitude: z.number().min(-180).max(180).nullable().optional(),
	bearing: z.number().min(0).max(360).nullable().optional(),
	dateTaken: z.string().datetime().nullable().optional()
});

export type ExifData = z.infer<typeof ExifDataSchema>;

/**
 * Media type discriminator for photos vs videos.
 */
export const MediaTypeSchema = z.enum(['photo', 'video']);
export type MediaType = z.infer<typeof MediaTypeSchema>;

/**
 * Schema for creating a new photo record after upload.
 */
export const PhotoCreateSchema = z.object({
	filename: z.string().min(1, 'Filename is required'),
	storage_path: z.string().min(1, 'Storage path is required'),
	storage_bucket: z.string().default('photos'),
	latitude: z.number().min(-90).max(90).nullable().optional(),
	longitude: z.number().min(-180).max(180).nullable().optional(),
	position_source: z.enum(['exif', 'manual']).default('manual'),
	bearing: z.number().min(0).max(360).nullable().optional(),
	bearing_source: z.enum(['exif', 'manual']).nullable().optional(),
	date_taken: z.string().datetime().nullable().optional(),
	date_source: z.enum(['exif', 'manual']).default('manual'),
	title: z.string().max(200).nullable().optional(),
	description: z.string().max(1000).nullable().optional(),
	media_type: MediaTypeSchema.default('photo'),
	duration: z.number().min(0).nullable().optional(),
	thumbnail_path: z.string().nullable().optional()
});

export type PhotoCreateInput = z.infer<typeof PhotoCreateSchema>;

/**
 * Schema for updating an existing photo's metadata.
 */
export const PhotoUpdateSchema = z.object({
	latitude: z.number().min(-90).max(90).nullable().optional(),
	longitude: z.number().min(-180).max(180).nullable().optional(),
	position_source: z.enum(['exif', 'manual']).optional(),
	bearing: z.number().min(0).max(360).nullable().optional(),
	bearing_source: z.enum(['exif', 'manual']).nullable().optional(),
	date_taken: z.string().datetime().nullable().optional(),
	date_source: z.enum(['exif', 'manual']).optional(),
	title: z.string().max(200).nullable().optional(),
	description: z.string().max(1000).nullable().optional(),
	duration: z.number().min(0).nullable().optional(),
	thumbnail_path: z.string().nullable().optional()
});

export type PhotoUpdateInput = z.infer<typeof PhotoUpdateSchema>;

/**
 * Schema specifically for updating photo position (drag-to-reposition).
 */
export const PhotoPositionSchema = z.object({
	latitude: z.number().min(-90).max(90),
	longitude: z.number().min(-180).max(180)
});

export type PhotoPositionInput = z.infer<typeof PhotoPositionSchema>;

/**
 * Schema for updating photo bearing/direction.
 */
export const PhotoBearingSchema = z.object({
	bearing: z.number().min(0).max(360)
});

export type PhotoBearingInput = z.infer<typeof PhotoBearingSchema>;

/**
 * Schema for photo list query options.
 */
export const PhotoListOptionsSchema = z.object({
	hasLocation: z.boolean().optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	limit: z.number().min(1).max(500).optional(),
	offset: z.number().min(0).optional()
});

export type PhotoListOptions = z.infer<typeof PhotoListOptionsSchema>;

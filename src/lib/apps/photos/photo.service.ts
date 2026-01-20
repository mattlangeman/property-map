import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, PhotoRow } from '$lib/db/types';
import { ServiceError } from '$lib/shared/service-errors';
import { UserProfileService } from '$lib/apps/users';
import {
	PhotoCreateSchema,
	PhotoUpdateSchema,
	PhotoPositionSchema,
	PhotoBearingSchema,
	type PhotoCreateInput,
	type PhotoListOptions
} from './photo.schema';
import { Photo, type PhotoWithUrl } from './photo.entity';
import type { MediaType } from './photo.schema';

const PHOTOS_TABLE = 'photos';
const STORAGE_BUCKET = 'photos';

/**
 * Service for photo CRUD operations and storage management.
 * All database interactions go through this service.
 */
export const PhotoService = {
	/**
	 * Upload a photo/video file to storage and create a database record.
	 * Optionally uploads a thumbnail for faster previews.
	 * Requires can_upload permission.
	 */
	async upload(
		supabase: SupabaseClient<Database>,
		file: File,
		metadata: Partial<Omit<PhotoCreateInput, 'filename' | 'storage_path'>> & {
			media_type?: MediaType;
			duration?: number | null;
		},
		userId: string,
		thumbnailFile?: File | null
	): Promise<PhotoRow> {
		// Check upload permission
		const canUpload = await UserProfileService.canUpload(supabase, userId);
		if (!canUpload) {
			throw new ServiceError.NotAuthorized('You do not have permission to upload photos');
		}

		// Generate unique storage path
		const timestamp = Date.now();
		const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
		const storagePath = `${userId}/${timestamp}-${safeName}`;

		// Upload main file to storage
		const { error: uploadError } = await supabase.storage
			.from(STORAGE_BUCKET)
			.upload(storagePath, file, {
				cacheControl: '3600',
				upsert: false
			});

		if (uploadError) {
			throw new ServiceError.Storage(`Failed to upload file: ${uploadError.message}`);
		}

		// Upload thumbnail if provided (for videos)
		let thumbnailPath: string | null = null;
		if (thumbnailFile) {
			const thumbName = `${timestamp}-thumb.jpg`;
			thumbnailPath = `${userId}/thumbs/${thumbName}`;

			const { error: thumbError } = await supabase.storage
				.from(STORAGE_BUCKET)
				.upload(thumbnailPath, thumbnailFile, {
					cacheControl: '3600',
					upsert: false
				});

			if (thumbError) {
				// Clean up main file if thumbnail upload fails
				await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
				throw new ServiceError.Storage(`Failed to upload thumbnail: ${thumbError.message}`);
			}
		}

		// Create database record - Zod schema will validate and apply defaults
		const input = {
			...metadata,
			filename: file.name,
			storage_path: storagePath,
			storage_bucket: STORAGE_BUCKET,
			thumbnail_path: thumbnailPath
		};

		const result = PhotoCreateSchema.safeParse(input);
		if (!result.success) {
			// Clean up uploaded files on validation failure
			const pathsToRemove = [storagePath];
			if (thumbnailPath) pathsToRemove.push(thumbnailPath);
			await supabase.storage.from(STORAGE_BUCKET).remove(pathsToRemove);
			throw new ServiceError.Validation(
				result.error.errors.map((e) => ({
					field: e.path.join('.'),
					message: e.message
				}))
			);
		}

		const { data, error } = await supabase
			.from(PHOTOS_TABLE)
			.insert({ ...result.data, user_id: userId })
			.select()
			.single();

		if (error) {
			// Clean up uploaded files on database error
			const pathsToRemove = [storagePath];
			if (thumbnailPath) pathsToRemove.push(thumbnailPath);
			await supabase.storage.from(STORAGE_BUCKET).remove(pathsToRemove);
			throw new Error(`Database error: ${error.message}`);
		}

		return data as PhotoRow;
	},

	/**
	 * Get all photos with signed URLs.
	 * All authenticated users can view all photos.
	 */
	async list(
		supabase: SupabaseClient<Database>,
		options: PhotoListOptions = {}
	): Promise<PhotoWithUrl[]> {
		let query = supabase
			.from(PHOTOS_TABLE)
			.select('*')
			.order('date_taken', { ascending: true, nullsFirst: false })
			.order('created_at', { ascending: true });

		// Filter by location presence
		if (options.hasLocation === true) {
			query = query.not('latitude', 'is', null).not('longitude', 'is', null);
		} else if (options.hasLocation === false) {
			query = query.or('latitude.is.null,longitude.is.null');
		}

		// Filter by date range
		if (options.startDate) {
			query = query.gte('date_taken', options.startDate);
		}
		if (options.endDate) {
			query = query.lte('date_taken', options.endDate);
		}

		// Pagination
		const limit = options.limit ?? 100;
		const offset = options.offset ?? 0;
		query = query.range(offset, offset + limit - 1);

		const { data, error } = await query;

		if (error) {
			throw new Error(`Database error: ${error.message}`);
		}

		// Get signed URLs for all photos/videos
		const photos = data as PhotoRow[];
		const photosWithUrls = await Promise.all(
			photos.map(async (photo) => {
				const url = await PhotoService.getSignedUrl(supabase, photo);
				const thumbnailUrl = await PhotoService.getThumbnailSignedUrl(supabase, photo);
				return { ...photo, url, thumbnailUrl };
			})
		);

		return photosWithUrls;
	},

	/**
	 * Get photos that need manual positioning for a specific user.
	 * Only returns the user's own photos since they can only edit their own.
	 */
	async getUnpositioned(
		supabase: SupabaseClient<Database>,
		userId: string
	): Promise<PhotoWithUrl[]> {
		const { data, error } = await supabase
			.from(PHOTOS_TABLE)
			.select('*')
			.eq('user_id', userId)
			.or('latitude.is.null,longitude.is.null')
			.order('date_taken', { ascending: true, nullsFirst: false })
			.order('created_at', { ascending: true });

		if (error) {
			throw new Error(`Database error: ${error.message}`);
		}

		const photos = data as PhotoRow[];
		const photosWithUrls = await Promise.all(
			photos.map(async (photo) => {
				const url = await PhotoService.getSignedUrl(supabase, photo);
				const thumbnailUrl = await PhotoService.getThumbnailSignedUrl(supabase, photo);
				return { ...photo, url, thumbnailUrl };
			})
		);

		return photosWithUrls;
	},

	/**
	 * Get a single photo by ID with signed URL.
	 */
	async getById(
		supabase: SupabaseClient<Database>,
		id: string
	): Promise<PhotoWithUrl | null> {
		const { data, error } = await supabase
			.from(PHOTOS_TABLE)
			.select('*')
			.eq('id', id)
			.single();

		if (error) {
			if (error.code === 'PGRST116') return null; // Not found
			throw new Error(`Database error: ${error.message}`);
		}

		const photo = data as PhotoRow;
		const url = await PhotoService.getSignedUrl(supabase, photo);
		const thumbnailUrl = await PhotoService.getThumbnailSignedUrl(supabase, photo);
		return { ...photo, url, thumbnailUrl };
	},

	/**
	 * Get a photo by ID or throw NotFound error.
	 */
	async getByIdOrThrow(
		supabase: SupabaseClient<Database>,
		id: string
	): Promise<PhotoWithUrl> {
		const photo = await PhotoService.getById(supabase, id);
		if (!photo) {
			throw new ServiceError.NotFound(`Photo not found: ${id}`);
		}
		return photo;
	},

	/**
	 * Update photo position (drag-to-reposition).
	 */
	async updatePosition(
		supabase: SupabaseClient<Database>,
		id: string,
		latitude: number,
		longitude: number,
		userId: string
	): Promise<PhotoRow> {
		const result = PhotoPositionSchema.safeParse({ latitude, longitude });
		if (!result.success) {
			throw new ServiceError.Validation(
				result.error.errors.map((e) => ({
					field: e.path.join('.'),
					message: e.message
				}))
			);
		}

		const existing = await PhotoService.getByIdOrThrow(supabase, id);
		if (!Photo.canBeEditedBy(existing, userId)) {
			throw new ServiceError.NotAuthorized('You can only edit your own photos');
		}

		const { data, error } = await supabase
			.from(PHOTOS_TABLE)
			.update({
				latitude: result.data.latitude,
				longitude: result.data.longitude,
				position_source: 'manual',
				updated_at: new Date().toISOString()
			})
			.eq('id', id)
			.select()
			.single();

		if (error) {
			throw new Error(`Database error: ${error.message}`);
		}

		return data as PhotoRow;
	},

	/**
	 * Update photo bearing/direction.
	 */
	async updateBearing(
		supabase: SupabaseClient<Database>,
		id: string,
		bearing: number,
		userId: string
	): Promise<PhotoRow> {
		const result = PhotoBearingSchema.safeParse({ bearing });
		if (!result.success) {
			throw new ServiceError.Validation(
				result.error.errors.map((e) => ({
					field: e.path.join('.'),
					message: e.message
				}))
			);
		}

		const existing = await PhotoService.getByIdOrThrow(supabase, id);
		if (!Photo.canBeEditedBy(existing, userId)) {
			throw new ServiceError.NotAuthorized('You can only edit your own photos');
		}

		const { data, error } = await supabase
			.from(PHOTOS_TABLE)
			.update({
				bearing: result.data.bearing,
				bearing_source: 'manual',
				updated_at: new Date().toISOString()
			})
			.eq('id', id)
			.select()
			.single();

		if (error) {
			throw new Error(`Database error: ${error.message}`);
		}

		return data as PhotoRow;
	},

	/**
	 * Update photo metadata.
	 */
	async update(
		supabase: SupabaseClient<Database>,
		id: string,
		input: unknown,
		userId: string
	): Promise<PhotoRow> {
		const result = PhotoUpdateSchema.safeParse(input);
		if (!result.success) {
			throw new ServiceError.Validation(
				result.error.errors.map((e) => ({
					field: e.path.join('.'),
					message: e.message
				}))
			);
		}

		const existing = await PhotoService.getByIdOrThrow(supabase, id);
		if (!Photo.canBeEditedBy(existing, userId)) {
			throw new ServiceError.NotAuthorized('You can only edit your own photos');
		}

		const { data, error } = await supabase
			.from(PHOTOS_TABLE)
			.update({
				...result.data,
				updated_at: new Date().toISOString()
			})
			.eq('id', id)
			.select()
			.single();

		if (error) {
			throw new Error(`Database error: ${error.message}`);
		}

		return data as PhotoRow;
	},

	/**
	 * Delete a photo/video and its storage files (including thumbnail).
	 */
	async delete(
		supabase: SupabaseClient<Database>,
		id: string,
		userId: string
	): Promise<void> {
		const existing = await PhotoService.getByIdOrThrow(supabase, id);
		if (!Photo.canBeEditedBy(existing, userId)) {
			throw new ServiceError.NotAuthorized('You can only delete your own photos');
		}

		// Build list of files to delete
		const filesToDelete = [existing.storage_path];
		if (existing.thumbnail_path) {
			filesToDelete.push(existing.thumbnail_path);
		}

		// Delete from storage first
		const { error: storageError } = await supabase.storage
			.from(existing.storage_bucket)
			.remove(filesToDelete);

		if (storageError) {
			console.error('Failed to delete storage files:', storageError);
			// Continue with database deletion even if storage fails
		}

		// Delete database record
		const { error } = await supabase.from(PHOTOS_TABLE).delete().eq('id', id);

		if (error) {
			throw new Error(`Database error: ${error.message}`);
		}
	},

	/**
	 * Get a signed URL for a photo/video.
	 * URLs are valid for 1 hour.
	 */
	async getSignedUrl(
		supabase: SupabaseClient<Database>,
		photo: PhotoRow
	): Promise<string> {
		const { data, error } = await supabase.storage
			.from(photo.storage_bucket)
			.createSignedUrl(photo.storage_path, 3600);

		if (error || !data) {
			console.error('Failed to create signed URL:', error);
			return ''; // Return empty string on failure
		}

		return data.signedUrl;
	},

	/**
	 * Get a signed URL for a video thumbnail.
	 * Returns null if no thumbnail exists.
	 */
	async getThumbnailSignedUrl(
		supabase: SupabaseClient<Database>,
		photo: PhotoRow
	): Promise<string | undefined> {
		if (!photo.thumbnail_path) return undefined;

		const { data, error } = await supabase.storage
			.from(photo.storage_bucket)
			.createSignedUrl(photo.thumbnail_path, 3600);

		if (error || !data) {
			console.error('Failed to create thumbnail signed URL:', error);
			return undefined;
		}

		return data.signedUrl;
	},

	/**
	 * Get count of unpositioned photos.
	 */
	async getUnpositionedCount(
		supabase: SupabaseClient<Database>,
		userId: string
	): Promise<number> {
		const { count, error } = await supabase
			.from(PHOTOS_TABLE)
			.select('*', { count: 'exact', head: true })
			.eq('user_id', userId)
			.or('latitude.is.null,longitude.is.null');

		if (error) {
			throw new Error(`Database error: ${error.message}`);
		}

		return count ?? 0;
	}
};

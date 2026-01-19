import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { PhotoService } from '$lib/apps/photos';
import { ServiceError } from '$lib/shared/service-errors';
import {
	PUBLIC_MAP_DEFAULT_LAT,
	PUBLIC_MAP_DEFAULT_LNG
} from '$env/static/public';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) {
		throw redirect(303, '/auth/login');
	}

	// Parse filter params
	const hasLocationParam = url.searchParams.get('hasLocation');
	const hasLocation = hasLocationParam === null ? undefined : hasLocationParam === 'true';
	const startDate = url.searchParams.get('startDate') ?? undefined;
	const endDate = url.searchParams.get('endDate') ?? undefined;

	// Fetch photos with filters
	const photos = await PhotoService.list(locals.supabase, user.id, {
		hasLocation,
		startDate,
		endDate
	});

	// Get count of unpositioned photos
	const unpositionedCount = await PhotoService.getUnpositionedCount(locals.supabase, user.id);

	return {
		photos,
		unpositionedCount,
		filters: {
			hasLocation: hasLocationParam === null ? null : hasLocationParam === 'true',
			startDate: startDate ?? null,
			endDate: endDate ?? null
		}
	};
};

export const actions: Actions = {
	/**
	 * Upload a new photo or video.
	 * Expects form data with file, metadata, and optional thumbnail (for videos).
	 */
	upload: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			throw error(401, 'Not authenticated');
		}

		const formData = await request.formData();
		const file = formData.get('file') as File | null;

		console.log('[Upload] File received:', file?.name, file?.size, file?.type);

		if (!file || file.size === 0) {
			console.log('[Upload] No file provided');
			return fail(400, { error: 'No file provided' });
		}

		// Parse optional EXIF data from form
		const latitude = formData.get('latitude');
		const longitude = formData.get('longitude');
		const bearing = formData.get('bearing');
		const dateTaken = formData.get('dateTaken');

		// Parse video-specific fields
		const mediaType = (formData.get('mediaType') as 'photo' | 'video') || 'photo';
		const durationStr = formData.get('duration');
		const duration = durationStr ? parseFloat(durationStr as string) : null;
		const thumbnailFile = formData.get('thumbnail') as File | null;

		console.log('[Upload] Media type:', mediaType, 'Duration:', duration);
		console.log('[Upload] Thumbnail:', thumbnailFile?.name, thumbnailFile?.size);

		// For videos without GPS, default to map center so they appear on the map
		const hasGps = latitude && longitude;
		const defaultLat = parseFloat(PUBLIC_MAP_DEFAULT_LAT) || 44.514679;
		const defaultLng = parseFloat(PUBLIC_MAP_DEFAULT_LNG) || -80.995797;

		const metadata = {
			latitude: latitude ? parseFloat(latitude as string) : (mediaType === 'video' ? defaultLat : null),
			longitude: longitude ? parseFloat(longitude as string) : (mediaType === 'video' ? defaultLng : null),
			position_source: hasGps ? ('exif' as const) : ('manual' as const),
			bearing: bearing ? parseFloat(bearing as string) : null,
			bearing_source: bearing ? ('exif' as const) : null,
			date_taken: dateTaken ? (dateTaken as string) : null,
			date_source: dateTaken ? ('exif' as const) : ('manual' as const),
			media_type: mediaType,
			duration: duration
		};

		try {
			console.log('[Upload] Calling PhotoService.upload...');
			const photo = await PhotoService.upload(
				locals.supabase,
				file,
				metadata,
				user.id,
				thumbnailFile && thumbnailFile.size > 0 ? thumbnailFile : null
			);
			console.log('[Upload] Success! Photo ID:', photo.id);
			return { success: true, photoId: photo.id };
		} catch (e) {
			console.error('[Upload] Error:', e);
			if (e instanceof ServiceError.Storage) {
				return fail(500, { error: e.message });
			}
			if (e instanceof ServiceError.Validation) {
				return fail(400, { error: e.message, issues: e.issues });
			}
			throw e;
		}
	},

	/**
	 * Update photo position (drag to reposition on map).
	 */
	updatePosition: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			throw error(401, 'Not authenticated');
		}

		const formData = await request.formData();
		const photoId = formData.get('photoId') as string;
		const latitude = parseFloat(formData.get('latitude') as string);
		const longitude = parseFloat(formData.get('longitude') as string);

		if (!photoId || isNaN(latitude) || isNaN(longitude)) {
			return fail(400, { error: 'Invalid position data' });
		}

		try {
			await PhotoService.updatePosition(locals.supabase, photoId, latitude, longitude, user.id);
			return { success: true };
		} catch (e) {
			if (e instanceof ServiceError.NotFound) {
				return fail(404, { error: e.message });
			}
			if (e instanceof ServiceError.NotAuthorized) {
				return fail(403, { error: e.message });
			}
			if (e instanceof ServiceError.Validation) {
				return fail(400, { error: e.message });
			}
			throw e;
		}
	},

	/**
	 * Update photo bearing/direction.
	 */
	updateBearing: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			throw error(401, 'Not authenticated');
		}

		const formData = await request.formData();
		const photoId = formData.get('photoId') as string;
		const bearing = parseFloat(formData.get('bearing') as string);

		if (!photoId || isNaN(bearing)) {
			return fail(400, { error: 'Invalid bearing data' });
		}

		try {
			await PhotoService.updateBearing(locals.supabase, photoId, bearing, user.id);
			return { success: true };
		} catch (e) {
			if (e instanceof ServiceError.NotFound) {
				return fail(404, { error: e.message });
			}
			if (e instanceof ServiceError.NotAuthorized) {
				return fail(403, { error: e.message });
			}
			if (e instanceof ServiceError.Validation) {
				return fail(400, { error: e.message });
			}
			throw e;
		}
	},

	/**
	 * Update photo position, bearing, and date together (from edit mode).
	 */
	updatePositionAndBearing: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			throw error(401, 'Not authenticated');
		}

		const formData = await request.formData();
		const photoId = formData.get('photoId') as string;
		const latitude = parseFloat(formData.get('latitude') as string);
		const longitude = parseFloat(formData.get('longitude') as string);
		const bearingStr = formData.get('bearing');
		const bearing = bearingStr ? parseFloat(bearingStr as string) : null;
		const dateTaken = formData.get('dateTaken') as string | null;

		if (!photoId || isNaN(latitude) || isNaN(longitude)) {
			return fail(400, { error: 'Invalid position data' });
		}

		try {
			// Update position
			await PhotoService.updatePosition(locals.supabase, photoId, latitude, longitude, user.id);

			// Update bearing if provided
			if (bearing !== null && !isNaN(bearing)) {
				await PhotoService.updateBearing(locals.supabase, photoId, bearing, user.id);
			}

			// Update date if provided
			if (dateTaken) {
				await PhotoService.update(locals.supabase, photoId, {
					date_taken: dateTaken,
					date_source: 'manual'
				}, user.id);
			}

			return { success: true };
		} catch (e) {
			if (e instanceof ServiceError.NotFound) {
				return fail(404, { error: e.message });
			}
			if (e instanceof ServiceError.NotAuthorized) {
				return fail(403, { error: e.message });
			}
			if (e instanceof ServiceError.Validation) {
				return fail(400, { error: e.message });
			}
			throw e;
		}
	},

	/**
	 * Delete a photo.
	 */
	delete: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			throw error(401, 'Not authenticated');
		}

		const formData = await request.formData();
		const photoId = formData.get('photoId') as string;

		if (!photoId) {
			return fail(400, { error: 'Photo ID is required' });
		}

		try {
			await PhotoService.delete(locals.supabase, photoId, user.id);
			return { success: true, deleted: photoId };
		} catch (e) {
			if (e instanceof ServiceError.NotFound) {
				return fail(404, { error: e.message });
			}
			if (e instanceof ServiceError.NotAuthorized) {
				return fail(403, { error: e.message });
			}
			throw e;
		}
	}
};

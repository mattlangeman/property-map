import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { PhotoService, Photo } from '$lib/apps/photos';
import { ServiceError } from '$lib/shared/service-errors';

export const load: PageServerLoad = async ({ locals, params }) => {
	const { user } = await locals.safeGetSession();
	if (!user) {
		throw redirect(303, '/auth/login');
	}

	const photo = await PhotoService.getById(locals.supabase, params.id);

	if (!photo) {
		throw error(404, 'Photo not found');
	}

	if (!Photo.canBeEditedBy(photo, user.id)) {
		throw error(403, 'Not authorized to view this photo');
	}

	return {
		photo
	};
};

export const actions: Actions = {
	/**
	 * Update photo metadata (title, description, date).
	 */
	update: async ({ request, locals, params }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			throw error(401, 'Not authenticated');
		}

		const formData = await request.formData();
		const title = formData.get('title') as string | null;
		const description = formData.get('description') as string | null;
		const dateTaken = formData.get('dateTaken') as string | null;

		try {
			await PhotoService.update(
				locals.supabase,
				params.id,
				{
					title: title || null,
					description: description || null,
					date_taken: dateTaken || null,
					date_source: 'manual' as const
				},
				user.id
			);

			return { success: true };
		} catch (e) {
			if (e instanceof ServiceError.NotFound) {
				return fail(404, { error: e.message });
			}
			if (e instanceof ServiceError.NotAuthorized) {
				return fail(403, { error: e.message });
			}
			if (e instanceof ServiceError.Validation) {
				return fail(400, { error: e.message, issues: e.issues });
			}
			throw e;
		}
	},

	/**
	 * Delete the photo.
	 */
	delete: async ({ locals, params }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			throw error(401, 'Not authenticated');
		}

		try {
			await PhotoService.delete(locals.supabase, params.id, user.id);
			throw redirect(303, '/photos');
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

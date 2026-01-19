import { createSupabaseServerClient } from '$lib/db/client';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	// Create Supabase client for this request
	event.locals.supabase = createSupabaseServerClient(event.cookies);

	// Safe session getter that returns null instead of throwing
	event.locals.safeGetSession = async () => {
		const {
			data: { session },
			error
		} = await event.locals.supabase.auth.getSession();

		if (error || !session) {
			return { session: null, user: null };
		}

		// Verify the user exists and is valid
		const {
			data: { user },
			error: userError
		} = await event.locals.supabase.auth.getUser();

		if (userError || !user) {
			return { session: null, user: null };
		}

		return { session, user };
	};

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			// Allow Supabase auth headers to pass through
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};

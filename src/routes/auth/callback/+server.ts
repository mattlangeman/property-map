import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * OAuth callback handler for email confirmation and OAuth providers.
 * Exchanges the code for a session and redirects to the photos page.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');
	const next = url.searchParams.get('next') ?? '/photos';

	if (code) {
		const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
		if (!error) {
			throw redirect(303, next);
		}
	}

	// If there's no code or an error occurred, redirect to login
	throw redirect(303, '/auth/login?error=auth_callback_failed');
};

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	// Mark this load function as depending on auth state
	depends('supabase:auth');

	const { session, user } = await locals.safeGetSession();

	return {
		session,
		user
	};
};

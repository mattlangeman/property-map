import { createSupabaseBrowserClient } from '$lib/db/client';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ data }) => {
	// Create browser client for client-side operations
	const supabase = createSupabaseBrowserClient();

	return {
		...data,
		supabase
	};
};

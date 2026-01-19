import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { Database } from './types';

/**
 * Creates a Supabase client for browser-side usage.
 * Uses SSR-aware client that handles cookies properly.
 */
export function createSupabaseBrowserClient() {
	return createBrowserClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Creates a Supabase client for server-side usage in load functions and actions.
 * Requires cookies object from the request event.
 */
export function createSupabaseServerClient(cookies: {
	get: (key: string) => string | undefined;
	set: (key: string, value: string, options: object) => void;
}) {
	return createServerClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			get: (key) => cookies.get(key),
			set: (key, value, options) => {
				// Only set cookies if we're on the server
				if (!isBrowser()) {
					cookies.set(key, value, { path: '/', ...options });
				}
			},
			remove: (key, options) => {
				if (!isBrowser()) {
					cookies.set(key, '', { path: '/', ...options, maxAge: 0 });
				}
			}
		}
	});
}

import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const confirmPassword = formData.get('confirmPassword') as string;

		if (!email || !password || !confirmPassword) {
			return fail(400, {
				error: 'All fields are required',
				values: { email }
			});
		}

		if (password !== confirmPassword) {
			return fail(400, {
				error: 'Passwords do not match',
				values: { email }
			});
		}

		if (password.length < 6) {
			return fail(400, {
				error: 'Password must be at least 6 characters',
				values: { email }
			});
		}

		const { error } = await locals.supabase.auth.signUp({
			email,
			password,
			options: {
				emailRedirectTo: `${url.origin}/auth/callback`
			}
		});

		if (error) {
			return fail(400, {
				error: error.message,
				values: { email }
			});
		}

		return {
			success: true,
			values: { email }
		};
	}
};

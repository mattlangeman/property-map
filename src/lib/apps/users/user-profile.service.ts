import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, UserProfileRow } from '$lib/db/types';
import { ServiceError } from '$lib/shared/service-errors';

const USER_PROFILES_TABLE = 'user_profiles';

/**
 * Service for user profile operations.
 * All database interactions go through this service.
 */
export const UserProfileService = {
	/**
	 * Get a user profile by ID.
	 */
	async getById(
		supabase: SupabaseClient<Database>,
		userId: string
	): Promise<UserProfileRow | null> {
		const { data, error } = await supabase
			.from(USER_PROFILES_TABLE)
			.select('*')
			.eq('id', userId)
			.single();

		if (error) {
			if (error.code === 'PGRST116') return null; // Not found
			throw new Error(`Database error: ${error.message}`);
		}

		return data as UserProfileRow;
	},

	/**
	 * Get a user profile by ID or throw NotFound error.
	 */
	async getByIdOrThrow(
		supabase: SupabaseClient<Database>,
		userId: string
	): Promise<UserProfileRow> {
		const profile = await UserProfileService.getById(supabase, userId);
		if (!profile) {
			throw new ServiceError.NotFound(`User profile not found: ${userId}`);
		}
		return profile;
	},

	/**
	 * Check if a user has upload permission.
	 * Returns false if profile doesn't exist or can_upload is false.
	 */
	async canUpload(
		supabase: SupabaseClient<Database>,
		userId: string
	): Promise<boolean> {
		const profile = await UserProfileService.getById(supabase, userId);
		return profile?.can_upload === true;
	},

	/**
	 * Ensure a user profile exists, creating one if necessary.
	 * This is useful for handling edge cases where the trigger didn't fire.
	 */
	async ensureExists(
		supabase: SupabaseClient<Database>,
		userId: string,
		email: string
	): Promise<UserProfileRow> {
		// First try to get existing profile
		const existing = await UserProfileService.getById(supabase, userId);
		if (existing) {
			return existing;
		}

		// Create a new profile (shouldn't happen if trigger is working)
		const { data, error } = await supabase
			.from(USER_PROFILES_TABLE)
			.insert({
				id: userId,
				email: email,
				can_upload: false
			})
			.select()
			.single();

		if (error) {
			// Profile might have been created by trigger between our check and insert
			if (error.code === '23505') {
				// Unique violation
				const profile = await UserProfileService.getById(supabase, userId);
				if (profile) return profile;
			}
			throw new Error(`Database error: ${error.message}`);
		}

		return data as UserProfileRow;
	}
};

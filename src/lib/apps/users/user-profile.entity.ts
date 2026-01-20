import type { UserProfileRow } from '$lib/db/types';

/**
 * Pure functions for user profile data - no database calls.
 * These compute derived values and handle business logic.
 */
export const UserProfile = {
	/**
	 * Check if the user has upload permission.
	 */
	canUpload(profile: UserProfileRow): boolean {
		return profile.can_upload === true;
	},

	/**
	 * Get display name or fall back to email.
	 */
	getDisplayName(profile: UserProfileRow): string {
		return profile.display_name || profile.email.split('@')[0];
	},

	/**
	 * Check if the profile belongs to the given user.
	 */
	belongsTo(profile: UserProfileRow, userId: string): boolean {
		return profile.id === userId;
	}
};

// Re-export the type from db/types for convenience
export type { UserProfileRow } from '$lib/db/types';

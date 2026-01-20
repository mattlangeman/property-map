import { z } from 'zod';

/**
 * Schema for user profile validation.
 */
export const UserProfileSchema = z.object({
	email: z.string().email('Must be a valid email'),
	display_name: z.string().max(100).nullable().optional(),
	can_upload: z.boolean().default(false)
});

/**
 * Partial schema for profile updates.
 */
export const UserProfilePartialSchema = UserProfileSchema.partial();

export type UserProfileInput = z.infer<typeof UserProfileSchema>;
export type UserProfilePartialInput = z.infer<typeof UserProfilePartialSchema>;

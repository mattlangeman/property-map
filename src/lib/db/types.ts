/**
 * Database types - These should be auto-generated from Supabase.
 * Run `supabase gen types typescript` to regenerate after schema changes.
 *
 * For now, we define the types manually based on the planned schema.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
	public: {
		Tables: {
			user_profiles: {
				Row: {
					id: string;
					email: string;
					display_name: string | null;
					can_upload: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id: string;
					email: string;
					display_name?: string | null;
					can_upload?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					email?: string;
					display_name?: string | null;
					can_upload?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			photos: {
				Row: {
					id: string;
					user_id: string;
					filename: string;
					storage_path: string;
					storage_bucket: string;
					latitude: number | null;
					longitude: number | null;
					position_source: string;
					bearing: number | null;
					bearing_source: string | null;
					date_taken: string | null;
					date_source: string;
					title: string | null;
					description: string | null;
					media_type: 'photo' | 'video';
					duration: number | null;
					thumbnail_path: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					filename: string;
					storage_path: string;
					storage_bucket?: string;
					latitude?: number | null;
					longitude?: number | null;
					position_source?: string;
					bearing?: number | null;
					bearing_source?: string | null;
					date_taken?: string | null;
					date_source?: string;
					title?: string | null;
					description?: string | null;
					media_type?: 'photo' | 'video';
					duration?: number | null;
					thumbnail_path?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					filename?: string;
					storage_path?: string;
					storage_bucket?: string;
					latitude?: number | null;
					longitude?: number | null;
					position_source?: string;
					bearing?: number | null;
					bearing_source?: string | null;
					date_taken?: string | null;
					date_source?: string;
					title?: string | null;
					description?: string | null;
					media_type?: 'photo' | 'video';
					duration?: number | null;
					thumbnail_path?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			[_ in never]: never;
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
}

// Convenience type aliases
export type PhotoRow = Database['public']['Tables']['photos']['Row'];
export type PhotoInsert = Database['public']['Tables']['photos']['Insert'];
export type PhotoUpdate = Database['public']['Tables']['photos']['Update'];

export type UserProfileRow = Database['public']['Tables']['user_profiles']['Row'];
export type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert'];
export type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update'];

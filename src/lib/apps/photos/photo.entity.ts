import type { PhotoRow } from '$lib/db/types';

/**
 * Photo with signed URLs for display.
 * For videos, thumbnailUrl contains the first-frame thumbnail.
 */
export interface PhotoWithUrl extends PhotoRow {
	url: string;
	thumbnailUrl?: string;
}

/**
 * Pure functions for photo data - no database calls.
 * These compute derived values and handle business logic.
 */
export const Photo = {
	/**
	 * Check if the media is a video.
	 */
	isVideo(media: PhotoRow): boolean {
		return media.media_type === 'video';
	},

	/**
	 * Check if the media is a photo.
	 */
	isPhoto(media: PhotoRow): boolean {
		return media.media_type === 'photo';
	},

	/**
	 * Check if the photo has GPS coordinates.
	 */
	hasLocation(photo: PhotoRow): boolean {
		return photo.latitude !== null && photo.longitude !== null;
	},

	/**
	 * Check if the photo has a bearing/direction set.
	 */
	hasBearing(photo: PhotoRow): boolean {
		return photo.bearing !== null;
	},

	/**
	 * Get the coordinates as a tuple [lat, lng] for Leaflet.
	 * Returns null if no location is set.
	 */
	getCoordinates(photo: PhotoRow): [number, number] | null {
		if (photo.latitude === null || photo.longitude === null) {
			return null;
		}
		return [photo.latitude, photo.longitude];
	},

	/**
	 * Convert bearing degrees to cardinal direction label.
	 */
	getBearingLabel(photo: PhotoRow): string | null {
		if (photo.bearing === null) return null;

		const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
		const index = Math.round(photo.bearing / 45) % 8;
		return directions[index];
	},

	/**
	 * Format the date taken for display.
	 */
	formatDateTaken(photo: PhotoRow): string | null {
		if (!photo.date_taken) return null;

		const date = new Date(photo.date_taken);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	},

	/**
	 * Get the season based on date taken (Northern Hemisphere).
	 */
	getSeason(photo: PhotoRow): 'spring' | 'summer' | 'fall' | 'winter' | null {
		if (!photo.date_taken) return null;

		const date = new Date(photo.date_taken);
		const month = date.getMonth(); // 0-11

		if (month >= 2 && month <= 4) return 'spring';
		if (month >= 5 && month <= 7) return 'summer';
		if (month >= 8 && month <= 10) return 'fall';
		return 'winter';
	},

	/**
	 * Get an icon/emoji for the season.
	 */
	getSeasonIcon(photo: PhotoRow): string {
		const season = Photo.getSeason(photo);
		switch (season) {
			case 'spring':
				return '🌸';
			case 'summer':
				return '☀️';
			case 'fall':
				return '🍂';
			case 'winter':
				return '❄️';
			default:
				return '📷';
		}
	},

	/**
	 * Get a display title - uses title if set, otherwise filename.
	 */
	getDisplayTitle(photo: PhotoRow): string {
		return photo.title || photo.filename;
	},

	/**
	 * Check if the current user can edit this photo.
	 */
	canBeEditedBy(photo: PhotoRow, userId: string): boolean {
		return photo.user_id === userId;
	},

	/**
	 * Get the month and year for grouping photos.
	 */
	getMonthYear(photo: PhotoRow): string | null {
		if (!photo.date_taken) return null;

		const date = new Date(photo.date_taken);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long'
		});
	},

	/**
	 * Calculate the age of the photo in days.
	 */
	getAgeDays(photo: PhotoRow): number | null {
		if (!photo.date_taken) return null;

		const date = new Date(photo.date_taken);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		return Math.floor(diffMs / (1000 * 60 * 60 * 24));
	},

	/**
	 * Format video duration as MM:SS or HH:MM:SS.
	 */
	formatDuration(media: PhotoRow): string | null {
		if (media.duration === null) return null;

		const totalSeconds = Math.floor(media.duration);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		if (hours > 0) {
			return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
		}
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	},

	/**
	 * Get the appropriate icon for the media type.
	 */
	getMediaIcon(media: PhotoRow): string {
		return Photo.isVideo(media) ? '🎬' : '📷';
	}
};

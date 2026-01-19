<script lang="ts">
	import { Photo, type PhotoWithUrl } from '../photo.entity';
	import { cn } from '$lib/utils';

	interface Props {
		photo: PhotoWithUrl;
		selected?: boolean;
		compact?: boolean;
		onClick?: () => void;
	}

	let { photo, selected = false, compact = false, onClick }: Props = $props();

	const displayTitle = $derived(Photo.getDisplayTitle(photo));
	const dateTaken = $derived(Photo.formatDateTaken(photo));
	const season = $derived(Photo.getSeason(photo));
	const seasonIcon = $derived(Photo.getSeasonIcon(photo));
	const bearingLabel = $derived(Photo.getBearingLabel(photo));
	const hasLocation = $derived(Photo.hasLocation(photo));
	const isVideo = $derived(Photo.isVideo(photo));
	const duration = $derived(Photo.formatDuration(photo));

	// For videos, prefer thumbnailUrl, fall back to url
	const thumbnailSrc = $derived(isVideo && photo.thumbnailUrl ? photo.thumbnailUrl : photo.url);
</script>

<button
	type="button"
	class={cn(
		'photo-card',
		selected && 'selected',
		compact && 'compact',
		!hasLocation && 'unpositioned'
	)}
	onclick={onClick}
>
	<div class="photo-thumbnail">
		{#if thumbnailSrc}
			<img src={thumbnailSrc} alt={displayTitle} loading="lazy" />
		{:else}
			<div class="placeholder">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
					<circle cx="9" cy="9" r="2" />
					<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
				</svg>
			</div>
		{/if}

		{#if !hasLocation}
			<div class="position-badge">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
					<circle cx="12" cy="10" r="3" />
				</svg>
			</div>
		{/if}

		<!-- Video play icon overlay -->
		{#if isVideo}
			<div class="video-play-icon">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="currentColor"
				>
					<polygon points="5 3 19 12 5 21 5 3" />
				</svg>
			</div>
		{/if}

		<!-- Video duration badge -->
		{#if isVideo && duration}
			<div class="duration-badge">
				{duration}
			</div>
		{/if}

		<!-- Compact mode: show date overlay on thumbnail -->
		{#if compact && dateTaken}
			<div class="date-overlay">
				<span class="season-icon">{seasonIcon}</span>
				{dateTaken}
			</div>
		{/if}
	</div>

	{#if !compact}
		<div class="photo-info">
			<p class="photo-title">{displayTitle}</p>
			{#if dateTaken}
				<p class="photo-date">
					<span class="season-icon">{seasonIcon}</span>
					{dateTaken}
				</p>
			{/if}
			{#if bearingLabel}
				<p class="photo-bearing">Facing {bearingLabel}</p>
			{/if}
		</div>
	{/if}
</button>

<style>
	.photo-card {
		display: flex;
		flex-direction: column;
		width: 100%;
		padding: 0;
		border: 2px solid hsl(var(--border));
		border-radius: var(--radius);
		background: hsl(var(--card));
		cursor: pointer;
		text-align: left;
		transition: all 0.15s ease;
		overflow: hidden;
	}

	.photo-card:hover {
		border-color: hsl(var(--primary) / 0.5);
	}

	.photo-card.selected {
		border-color: hsl(var(--primary));
		box-shadow: 0 0 0 3px hsl(var(--primary) / 0.3);
	}

	.photo-card.unpositioned {
		border-style: dashed;
		border-color: hsl(var(--destructive) / 0.5);
	}

	.photo-card.unpositioned.selected {
		border-color: hsl(var(--destructive));
		box-shadow: 0 0 0 3px hsl(var(--destructive) / 0.3);
	}

	.photo-thumbnail {
		position: relative;
		aspect-ratio: 4 / 3;
		background: hsl(var(--muted));
		overflow: hidden;
	}

	.photo-thumbnail img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: hsl(var(--muted-foreground));
	}

	.position-badge {
		position: absolute;
		top: 6px;
		right: 6px;
		padding: 4px;
		background: hsl(var(--destructive));
		border-radius: 50%;
		color: hsl(var(--destructive-foreground));
	}

	.date-overlay {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 6px 8px;
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
		color: white;
		font-size: 11px;
		font-weight: 500;
	}

	.season-icon {
		margin-right: 4px;
	}

	.video-play-icon {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.6);
		border-radius: 50%;
		color: white;
		pointer-events: none;
	}

	.video-play-icon svg {
		margin-left: 3px; /* Optical centering for play triangle */
	}

	.duration-badge {
		position: absolute;
		bottom: 6px;
		right: 6px;
		padding: 2px 6px;
		background: rgba(0, 0, 0, 0.75);
		border-radius: 4px;
		color: white;
		font-size: 11px;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}

	.photo-info {
		padding: 0.75rem;
	}

	.photo-title {
		font-size: 0.875rem;
		font-weight: 500;
		color: hsl(var(--foreground));
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.photo-date {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
		margin-top: 0.25rem;
	}

	.photo-bearing {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
		margin-top: 0.125rem;
	}
</style>

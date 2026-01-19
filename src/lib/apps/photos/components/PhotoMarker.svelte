<script lang="ts">
	import { Photo, type PhotoWithUrl } from '../photo.entity';

	interface Props {
		photo: PhotoWithUrl;
		selected?: boolean;
	}

	let { photo, selected = false }: Props = $props();

	const bearing = $derived(photo.bearing);
	const displayTitle = $derived(Photo.getDisplayTitle(photo));
</script>

<div class="photo-marker" class:selected>
	{#if bearing !== null}
		<div class="direction-arrow" style="transform: translateX(-50%) rotate({bearing}deg)"></div>
	{/if}

	{#if photo.url}
		<img src={photo.url} alt={displayTitle} loading="lazy" />
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
</div>

<style>
	.photo-marker {
		position: relative;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		border: 3px solid white;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
		overflow: hidden;
		background-color: hsl(var(--muted));
		cursor: pointer;
		transition: transform 0.15s ease;
	}

	.photo-marker:hover {
		transform: scale(1.1);
	}

	.photo-marker.selected {
		border-color: hsl(var(--primary));
		box-shadow:
			0 0 0 3px hsl(var(--primary) / 0.3),
			0 2px 8px rgba(0, 0, 0, 0.3);
	}

	.photo-marker img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.direction-arrow {
		position: absolute;
		top: -12px;
		left: 50%;
		width: 0;
		height: 0;
		border-left: 6px solid transparent;
		border-right: 6px solid transparent;
		border-bottom: 12px solid hsl(var(--primary));
		transform-origin: bottom center;
		z-index: 1;
	}

	.placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		color: hsl(var(--muted-foreground));
	}
</style>

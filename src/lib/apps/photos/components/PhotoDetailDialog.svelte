<script lang="ts">
	import { Photo, type PhotoWithUrl } from '../photo.entity';
	import DirectionPicker from './DirectionPicker.svelte';

	interface Props {
		photo: PhotoWithUrl | null;
		open: boolean;
		onClose: () => void;
		onBearingChange?: (bearing: number) => void;
		onDelete?: () => void;
		onEdit?: () => void;
	}

	let { photo, open, onClose, onBearingChange, onDelete, onEdit }: Props = $props();

	// Close on escape
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			onClose();
		}
	}

	// Derived values
	const displayTitle = $derived(photo ? Photo.getDisplayTitle(photo) : '');
	const dateTaken = $derived(photo ? Photo.formatDateTaken(photo) : null);
	const seasonIcon = $derived(photo ? Photo.getSeasonIcon(photo) : '');
	const bearingLabel = $derived(photo ? Photo.getBearingLabel(photo) : null);
	const hasLocation = $derived(photo ? Photo.hasLocation(photo) : false);
	const coordinates = $derived(photo ? Photo.getCoordinates(photo) : null);
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if open && photo}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-[9998] bg-black/80"
		onclick={onClose}
		onkeydown={(e) => e.key === 'Enter' && onClose()}
		role="button"
		tabindex="-1"
		aria-label="Close dialog"
	></div>

	<!-- Dialog -->
	<div
		class="fixed left-1/2 top-1/2 z-[9999] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-background shadow-xl"
		role="dialog"
		aria-modal="true"
		aria-labelledby="dialog-title"
	>
		<!-- Close button -->
		<button
			type="button"
			class="absolute right-4 top-4 rounded-sm p-1 text-muted-foreground opacity-70 transition-opacity hover:opacity-100"
			onclick={onClose}
		>
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
				<path d="M18 6 6 18" />
				<path d="m6 6 12 12" />
			</svg>
			<span class="sr-only">Close</span>
		</button>

		<div class="flex flex-col md:flex-row">
			<!-- Photo -->
			<div class="flex-1 bg-black">
				{#if photo.url}
					<img src={photo.url} alt={displayTitle} class="h-auto w-full object-contain md:max-h-[70vh]" />
				{:else}
					<div class="flex aspect-video items-center justify-center bg-muted">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="48"
							height="48"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="text-muted-foreground"
						>
							<rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
							<circle cx="9" cy="9" r="2" />
							<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
						</svg>
					</div>
				{/if}
			</div>

			<!-- Details sidebar -->
			<div class="w-full space-y-6 p-6 md:w-72">
				<div>
					<h2 id="dialog-title" class="text-lg font-semibold">{displayTitle}</h2>
					{#if photo.description}
						<p class="mt-2 text-sm text-muted-foreground">{photo.description}</p>
					{/if}
				</div>

				<!-- Date info -->
				{#if dateTaken}
					<div>
						<h3 class="text-sm font-medium text-muted-foreground">Date Taken</h3>
						<p class="mt-1">
							<span class="mr-1">{seasonIcon}</span>
							{dateTaken}
						</p>
					</div>
				{/if}

				<!-- Location info -->
				<div>
					<h3 class="text-sm font-medium text-muted-foreground">Location</h3>
					{#if hasLocation && coordinates}
						<p class="mt-1 text-sm">
							{coordinates[0].toFixed(6)}, {coordinates[1].toFixed(6)}
						</p>
						<p class="text-xs text-muted-foreground">
							Source: {photo.position_source}
						</p>
					{:else}
						<p class="mt-1 text-sm text-destructive">Not positioned on map</p>
					{/if}
				</div>

				<!-- Direction picker -->
				{#if onBearingChange}
					<div>
						<h3 class="mb-2 text-sm font-medium text-muted-foreground">Direction Facing</h3>
						<DirectionPicker
							bearing={photo.bearing}
							onChange={onBearingChange}
							size={100}
						/>
					</div>
				{:else if bearingLabel}
					<div>
						<h3 class="text-sm font-medium text-muted-foreground">Direction Facing</h3>
						<p class="mt-1">{bearingLabel} ({photo.bearing}°)</p>
					</div>
				{/if}

				<!-- Actions -->
				<div class="flex flex-col gap-2 pt-4">
					{#if onEdit}
						<button
							type="button"
							class="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
							onclick={onEdit}
						>
							Edit Details
						</button>
					{/if}
					{#if onDelete}
						<button
							type="button"
							class="inline-flex items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
							onclick={onDelete}
						>
							Delete Photo
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}
</style>

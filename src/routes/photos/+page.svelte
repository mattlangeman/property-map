<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		PUBLIC_MAP_DEFAULT_LAT,
		PUBLIC_MAP_DEFAULT_LNG
	} from '$env/static/public';
	import type { PageData, ActionData } from './$types';
	import type { PhotoWithUrl } from '$lib/apps/photos';
	import { Photo } from '$lib/apps/photos';
	import {
		PhotoMap,
		PhotoUploader,
		PhotoCard
	} from '$lib/apps/photos/components';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	// UI state
	let selectedPhoto = $state<PhotoWithUrl | null>(null);
	let showUploader = $state(false);
	let isPositioningMode = $state(false);
	let pendingUploads = $state<
		Array<{
			file: File;
			strippedFile: File;
			exifData: { latitude?: number | null; longitude?: number | null; bearing?: number | null; dateTaken?: string | null };
			preview: string;
			mediaType: 'photo' | 'video';
			duration: number | null;
			thumbnailBlob: Blob | null;
		}>
	>([]);

	// Map reference
	let mapComponent: PhotoMap;

	// Photo list container for scroll-to behavior
	let photoListContainer: HTMLDivElement;

	// Get photos with and without locations
	const positionedPhotos = $derived(data.photos.filter((p) => Photo.hasLocation(p)));
	const unpositionedPhotos = $derived(data.photos.filter((p) => !Photo.hasLocation(p)));

	// Current unpositioned photo being placed
	const currentPlacingPhoto = $derived(
		isPositioningMode && unpositionedPhotos.length > 0 ? unpositionedPhotos[0] : null
	);

	function handlePhotoSelect(photo: PhotoWithUrl) {
		selectedPhoto = photo;

		// Scroll the thumbnail into view in the sidebar
		setTimeout(() => {
			const thumbnailEl = photoListContainer?.querySelector(`[data-photo-id="${photo.id}"]`);
			if (thumbnailEl) {
				thumbnailEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
			}
		}, 0);
	}

	async function handleThumbnailClick(photo: PhotoWithUrl) {
		selectedPhoto = photo;

		// If photo has location, pan to it and open popup
		if (Photo.hasLocation(photo)) {
			mapComponent?.panToPhoto(photo.id);
			// Small delay to let pan animation start before opening popup
			setTimeout(() => {
				mapComponent?.openPopup(photo.id);
			}, 100);
		} else {
			// For unpositioned items, place at map center and enter edit mode
			const defaultLat = parseFloat(PUBLIC_MAP_DEFAULT_LAT) || 44.514679;
			const defaultLng = parseFloat(PUBLIC_MAP_DEFAULT_LNG) || -80.995797;

			console.log('[Page] Positioning unpositioned photo at:', defaultLat, defaultLng);

			// First set position to map center and wait for it to complete
			await setPhotoPosition(photo.id, defaultLat, defaultLng);

			console.log('[Page] Position set, data reloaded. Entering edit mode...');

			// Wait for data reload and marker creation, then enter edit mode
			setTimeout(() => {
				console.log('[Page] Panning to photo and entering edit mode');
				mapComponent?.panToPhoto(photo.id);
				setTimeout(() => {
					console.log('[Page] Calling enterEditMode');
					mapComponent?.enterEditMode(photo.id);
				}, 200);
			}, 100);
		}
	}

	// Separate function that returns a promise for positioning
	async function setPhotoPosition(photoId: string, lat: number, lng: number): Promise<void> {
		const formData = new FormData();
		formData.set('photoId', photoId);
		formData.set('latitude', lat.toString());
		formData.set('longitude', lng.toString());

		await fetch('?/updatePosition', {
			method: 'POST',
			body: formData
		});

		await invalidateAll();
	}

	function handlePhotoMove(photoId: string, lat: number, lng: number) {
		// Submit position update via form
		const formData = new FormData();
		formData.set('photoId', photoId);
		formData.set('latitude', lat.toString());
		formData.set('longitude', lng.toString());

		fetch('?/updatePosition', {
			method: 'POST',
			body: formData
		}).then(() => {
			invalidateAll();
		});
	}

	function handleMapClick(lat: number, lng: number) {
		if (!isPositioningMode || !currentPlacingPhoto) return;

		// Position the current unpositioned photo
		handlePhotoMove(currentPlacingPhoto.id, lat, lng);
	}

	function handlePhotoUpdate(photoId: string, lat: number, lng: number, bearing: number | null, dateTaken: string | null) {
		// Submit full update (position + bearing + date) via form
		const formData = new FormData();
		formData.set('photoId', photoId);
		formData.set('latitude', lat.toString());
		formData.set('longitude', lng.toString());
		if (bearing !== null) {
			formData.set('bearing', bearing.toString());
		}
		if (dateTaken !== null) {
			formData.set('dateTaken', dateTaken);
		}

		fetch('?/updatePositionAndBearing', {
			method: 'POST',
			body: formData
		}).then(() => {
			invalidateAll();
		});
	}

	async function handleUpload(
		files: Array<{
			file: File;
			strippedFile: File;
			exifData: { latitude?: number | null; longitude?: number | null; bearing?: number | null; dateTaken?: string | null };
			preview: string;
			mediaType: 'photo' | 'video';
			duration: number | null;
			thumbnailBlob: Blob | null;
		}>
	) {
		console.log('[handleUpload] Received files:', files.length);
		for (const upload of files) {
			console.log('[handleUpload] Uploading:', upload.file.name, 'mediaType:', upload.mediaType, 'duration:', upload.duration);
			const formData = new FormData();
			formData.set('file', upload.strippedFile);

			if (upload.exifData.latitude != null) {
				formData.set('latitude', upload.exifData.latitude.toString());
			}
			if (upload.exifData.longitude != null) {
				formData.set('longitude', upload.exifData.longitude.toString());
			}
			if (upload.exifData.bearing != null) {
				formData.set('bearing', upload.exifData.bearing.toString());
			}
			if (upload.exifData.dateTaken) {
				formData.set('dateTaken', upload.exifData.dateTaken);
			}

			// Add video-specific fields
			formData.set('mediaType', upload.mediaType);
			if (upload.duration != null) {
				formData.set('duration', upload.duration.toString());
			}
			if (upload.thumbnailBlob) {
				formData.set('thumbnail', upload.thumbnailBlob, 'thumbnail.jpg');
			}

			const response = await fetch('?/upload', {
				method: 'POST',
				body: formData
			});
			const result = await response.text();
			console.log('[handleUpload] Response status:', response.status, 'Result:', result.substring(0, 200));

			// Clean up preview URL
			URL.revokeObjectURL(upload.preview);
		}

		showUploader = false;
		invalidateAll();
	}

</script>

<svelte:head>
	<title>Photo Map - Property Photo Map</title>
</svelte:head>

<div class="flex h-screen flex-col">
	<!-- Header -->
	<header class="flex items-center justify-between border-b bg-background px-4 py-3">
		<div class="flex items-center gap-4">
			<a href="/" class="text-lg font-semibold">Property Photo Map</a>
			{#if data.unpositionedCount > 0}
				<button
					type="button"
					class="inline-flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive"
					onclick={() => (isPositioningMode = !isPositioningMode)}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
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
					{data.unpositionedCount} to position
				</button>
			{/if}
		</div>

		<div class="flex items-center gap-2">
			<button
				type="button"
				class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
				onclick={() => (showUploader = !showUploader)}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="mr-2"
				>
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="17 8 12 3 7 8" />
					<line x1="12" x2="12" y1="3" y2="15" />
				</svg>
				Upload Photos
			</button>

			<a
				href="/"
				class="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
			>
				Back
			</a>
		</div>
	</header>

	<!-- Main content -->
	<div class="flex flex-1 overflow-hidden">
		<!-- Sidebar -->
		<aside class="flex w-80 flex-col border-r bg-muted/30">
			<!-- Photo list -->
			<div bind:this={photoListContainer} class="flex-1 overflow-y-auto p-4">
				{#if showUploader}
					<div class="mb-4">
						<h3 class="mb-2 text-sm font-medium">Upload Photos</h3>
						<PhotoUploader onUpload={handleUpload} />
					</div>
				{/if}

				{#if isPositioningMode && currentPlacingPhoto}
					<div class="mb-4 rounded-lg border border-primary bg-primary/5 p-4">
						<h3 class="mb-2 text-sm font-medium text-primary">Position This Photo</h3>
						<p class="mb-3 text-xs text-muted-foreground">
							Click on the map to place this photo
						</p>
						<PhotoCard photo={currentPlacingPhoto} compact />
						<button
							type="button"
							class="mt-3 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm transition-colors hover:bg-accent"
							onclick={() => (isPositioningMode = false)}
						>
							Cancel Positioning
						</button>
					</div>
				{/if}

				<div class="space-y-2">
					{#each data.photos as photo (photo.id)}
						<div data-photo-id={photo.id}>
							<PhotoCard
								{photo}
								compact
								selected={selectedPhoto?.id === photo.id}
								onClick={() => handleThumbnailClick(photo)}
							/>
						</div>
					{/each}

					{#if data.photos.length === 0}
						<div class="py-8 text-center text-muted-foreground">
							<p class="text-sm">No photos yet</p>
							<p class="text-xs">Upload some photos to get started</p>
						</div>
					{/if}
				</div>
			</div>

			<!-- Footer stats -->
			<div class="border-t p-4 text-xs text-muted-foreground">
				{data.photos.length} photos
				{#if positionedPhotos.length !== data.photos.length}
					&middot; {positionedPhotos.length} positioned
				{/if}
			</div>
		</aside>

		<!-- Map -->
		<main class="relative flex-1">
			<PhotoMap
				bind:this={mapComponent}
				photos={data.photos}
				selectedPhotoId={selectedPhoto?.id ?? null}
				editable={true}
				onPhotoSelect={handlePhotoSelect}
				onPhotoMove={handlePhotoMove}
				onPhotoUpdate={handlePhotoUpdate}
				onMapClick={isPositioningMode ? handleMapClick : undefined}
			/>

			<!-- Map controls -->
			<div class="absolute bottom-4 right-4 flex flex-col gap-2">
				<button
					type="button"
					class="rounded-full bg-background p-3 shadow-lg transition-colors hover:bg-accent"
					onclick={() => mapComponent?.fitToPhotos()}
					title="Fit to photos"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M15 3h6v6" />
						<path d="M9 21H3v-6" />
						<path d="m21 3-7 7" />
						<path d="m3 21 7-7" />
					</svg>
				</button>
				<button
					type="button"
					class="rounded-full bg-background p-3 shadow-lg transition-colors hover:bg-accent"
					onclick={() => mapComponent?.panToDefault()}
					title="Go to default location"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
						<polyline points="9 22 9 12 15 12 15 22" />
					</svg>
				</button>
			</div>
		</main>
	</div>
</div>

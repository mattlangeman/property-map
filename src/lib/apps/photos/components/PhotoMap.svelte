<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import {
		PUBLIC_MAP_DEFAULT_LAT,
		PUBLIC_MAP_DEFAULT_LNG,
		PUBLIC_MAP_DEFAULT_ZOOM
	} from '$env/static/public';
	import type { PhotoWithUrl } from '../photo.entity';
	import { Photo } from '../photo.entity';

	interface Props {
		photos: PhotoWithUrl[];
		selectedPhotoId?: string | null;
		editable?: boolean;
		currentUserId?: string | null;
		onPhotoSelect?: (photo: PhotoWithUrl) => void;
		onPhotoMove?: (photoId: string, lat: number, lng: number) => void;
		onPhotoUpdate?: (photoId: string, lat: number, lng: number, bearing: number | null, dateTaken: string | null) => void;
		onMapClick?: (lat: number, lng: number) => void;
	}

	let {
		photos,
		selectedPhotoId = null,
		editable = false,
		currentUserId = null,
		onPhotoSelect,
		onPhotoMove,
		onPhotoUpdate,
		onMapClick
	}: Props = $props();

	/**
	 * Check if the current user can edit a photo (i.e., owns it).
	 */
	function canEditPhoto(photo: PhotoWithUrl): boolean {
		return editable && currentUserId !== null && Photo.canBeEditedBy(photo, currentUserId);
	}

	let mapContainer: HTMLDivElement;
	let map: L.Map | null = null;
	let markers: Map<string, L.Marker> = new Map();
	let L: typeof import('leaflet') | null = null;

	// Edit mode state
	let editingPhotoId = $state<string | null>(null);
	let editPosition = $state<{ lat: number; lng: number } | null>(null);
	let editBearing = $state<number | null>(null);
	let editDate = $state<string | null>(null);
	let directionLine: L.Polyline | null = null;
	let directionHandle: L.Marker | null = null;

	// Derived: are we currently editing?
	const isEditing = $derived(editingPhotoId !== null);
	const editingPhoto = $derived(editingPhotoId ? photos.find(p => p.id === editingPhotoId) : null);

	// Lightbox state for full-screen photo view
	let lightboxPhoto = $state<PhotoWithUrl | null>(null);

	// Parse default coordinates from env vars
	const defaultLat = parseFloat(PUBLIC_MAP_DEFAULT_LAT) || 44.514679;
	const defaultLng = parseFloat(PUBLIC_MAP_DEFAULT_LNG) || -80.995797;
	const defaultZoom = parseInt(PUBLIC_MAP_DEFAULT_ZOOM) || 15;

	// Get positioned photos
	const positionedPhotos = $derived(photos.filter((p) => Photo.hasLocation(p)));

	// Calculate map bounds from photos
	function getBounds(): L.LatLngBounds | null {
		if (!L || positionedPhotos.length === 0) return null;

		const coordinates = positionedPhotos
			.map((p) => Photo.getCoordinates(p))
			.filter((c): c is [number, number] => c !== null);

		if (coordinates.length === 0) return null;

		return L.latLngBounds(coordinates);
	}

	onMount(async () => {
		if (!browser) return;

		// Dynamically import Leaflet
		L = await import('leaflet');

		// Initialize map
		map = L.map(mapContainer, {
			center: [defaultLat, defaultLng],
			zoom: defaultZoom,
			zoomControl: true
		});

		// Define base layers
		const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
			maxZoom: 19
		});

		const satelliteLayer = L.tileLayer(
			'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
			{
				attribution:
					'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
				maxZoom: 19
			}
		);

		// Add satellite layer as default
		satelliteLayer.addTo(map);

		// Add layer control
		L.control
			.layers(
				{
					Satellite: satelliteLayer,
					'Street Map': streetLayer
				},
				{},
				{ position: 'topright' }
			)
			.addTo(map);

		// Fit bounds to photos if available
		const bounds = getBounds();
		if (bounds) {
			map.fitBounds(bounds, { padding: [50, 50] });
		}

		// Handle map clicks in editable mode
		if (editable && onMapClick) {
			map.on('click', (e: L.LeafletMouseEvent) => {
				onMapClick(e.latlng.lat, e.latlng.lng);
			});
		}

		// Setup popup event listeners for edit button
		setupPopupListeners();

		// Create initial markers
		updateMarkers();
	});

	onDestroy(() => {
		if (map) {
			map.remove();
			map = null;
		}
		markers.clear();
	});

	// Update markers when photos change
	$effect(() => {
		if (map && L) {
			updateMarkers();
		}
	});

	// Update selected marker styling and z-index
	$effect(() => {
		markers.forEach((marker, id) => {
			const isSelected = id === selectedPhotoId;

			// Update visual styling
			const element = marker.getElement();
			if (element) {
				// Handle both simple pin and pin with direction
				const container = element.querySelector('.pin-marker, .pin-marker-with-direction');
				if (container) {
					container.classList.toggle('selected', isSelected);
				}
			}

			// Elevate selected marker above others
			marker.setZIndexOffset(isSelected ? 500 : 0);
		});
	});

	function updateMarkers() {
		if (!map || !L) return;

		// Remove markers for photos no longer in list
		markers.forEach((marker, id) => {
			if (!photos.find((p) => p.id === id)) {
				marker.remove();
				markers.delete(id);
			}
		});

		// Add or update markers for current photos
		positionedPhotos.forEach((photo) => {
			const coords = Photo.getCoordinates(photo);
			if (!coords) return;

			const existingMarker = markers.get(photo.id);
			if (existingMarker) {
				// Update position if changed
				existingMarker.setLatLng(coords);
			} else {
				// Create new marker
				createMarker(photo, coords);
			}
		});
	}

	function createMarker(photo: PhotoWithUrl, coords: [number, number]) {
		if (!map || !L) return;

		// Create custom pin-style icon with optional direction arrow
		const markerHtml = createMarkerHtml(photo);
		const hasBearing = photo.bearing !== null;

		// Use larger container when photo has bearing to accommodate direction arrow
		const iconSize: [number, number] = hasBearing ? [80, 80] : [32, 42];
		const iconAnchor: [number, number] = hasBearing ? [40, 66] : [16, 42];

		const icon = L.divIcon({
			html: markerHtml,
			className: 'pin-marker-container',
			iconSize,
			iconAnchor
		});

		const marker = L.marker(coords, {
			icon,
			draggable: canEditPhoto(photo)
		});

		// Bind popup with photo preview
		const popupContent = createPopupHtml(photo);
		marker.bindPopup(popupContent, {
			maxWidth: 280,
			minWidth: 200,
			offset: [0, -35], // Offset above the pin
			className: 'photo-popup'
		});

		// Click handler - open popup and notify parent
		marker.on('click', () => {
			if (onPhotoSelect) {
				onPhotoSelect(photo);
			}
		});

		// Drag handler for repositioning (only for user's own photos)
		if (canEditPhoto(photo) && onPhotoMove) {
			marker.on('dragend', () => {
				const position = marker.getLatLng();
				onPhotoMove(photo.id, position.lat, position.lng);
			});
		}

		// Bring marker to front on hover (helps with overlapping markers)
		marker.on('mouseover', () => {
			marker.setZIndexOffset(1000);
		});
		marker.on('mouseout', () => {
			// Keep elevated if this is the selected photo
			marker.setZIndexOffset(photo.id === selectedPhotoId ? 500 : 0);
		});

		marker.addTo(map);
		markers.set(photo.id, marker);
	}

	function createPopupHtml(photo: PhotoWithUrl): string {
		const title = Photo.getDisplayTitle(photo);
		const dateTaken = Photo.formatDateTaken(photo);
		const seasonIcon = Photo.getSeasonIcon(photo);
		const bearingLabel = Photo.getBearingLabel(photo);
		const bearing = photo.bearing;
		const isVideo = Photo.isVideo(photo);
		const duration = Photo.formatDuration(photo);

		// For videos, use thumbnail for the popup preview
		const previewUrl = isVideo && photo.thumbnailUrl ? photo.thumbnailUrl : photo.url;

		let html = '<div class="photo-popup-content">';

		// Photo/Video image with expand button
		html += '<div class="photo-popup-image-container">';
		if (previewUrl) {
			html += `<img src="${previewUrl}" alt="${title}" class="photo-popup-image" />`;
			html += `<button class="photo-popup-expand-btn" data-photo-id="${photo.id}" title="View full screen">
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/>
				</svg>
			</button>`;

			// Video play icon overlay
			if (isVideo) {
				html += `<div class="photo-popup-video-play">
					<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
						<polygon points="5 3 19 12 5 21 5 3"/>
					</svg>
				</div>`;
			}

			// Duration badge for videos
			if (isVideo && duration) {
				html += `<div class="photo-popup-duration">${duration}</div>`;
			}
		}

		// Bearing arrow overlay on image
		if (bearing !== null) {
			html += `<div class="photo-popup-bearing-arrow" style="transform: rotate(${bearing}deg)">
				<svg viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
				</svg>
			</div>`;
		}
		html += '</div>';

		// Info section
		html += '<div class="photo-popup-info">';
		html += `<div class="photo-popup-title">${title}</div>`;

		if (dateTaken) {
			html += `<div class="photo-popup-date">${seasonIcon} ${dateTaken}</div>`;
		}

		if (bearingLabel && bearing !== null) {
			html += `<div class="photo-popup-bearing">Facing ${bearingLabel} (${Math.round(bearing)}°)</div>`;
		}

		// Action buttons row
		html += '<div class="photo-popup-actions">';

		// Expand button
		html += `<button class="photo-popup-action-btn photo-popup-expand-text-btn" data-photo-id="${photo.id}">
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/>
			</svg>
			Full Screen
		</button>`;

		// Edit button (only for user's own photos)
		if (canEditPhoto(photo)) {
			html += `<button class="photo-popup-action-btn photo-popup-edit-btn" data-photo-id="${photo.id}">
				<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
					<path d="m15 5 4 4"/>
				</svg>
				Edit
			</button>`;
		}

		html += '</div>'; // close actions
		html += '</div></div>';

		return html;
	}

	// Setup popup event listeners after map is ready
	function setupPopupListeners() {
		if (!map) return;

		map.on('popupopen', (e: L.PopupEvent) => {
			const popup = e.popup;
			const content = popup.getElement();
			if (!content) return;

			// Edit button listener
			const editBtn = content.querySelector('.photo-popup-edit-btn');
			if (editBtn) {
				editBtn.addEventListener('click', (event) => {
					const photoId = (event.currentTarget as HTMLElement).dataset.photoId;
					if (photoId) {
						map?.closePopup();
						startEdit(photoId);
					}
				});
			}

			// Expand button listeners (both icon and text buttons)
			const expandBtns = content.querySelectorAll('.photo-popup-expand-btn, .photo-popup-expand-text-btn');
			expandBtns.forEach(btn => {
				btn.addEventListener('click', (event) => {
					const photoId = (event.currentTarget as HTMLElement).dataset.photoId;
					if (photoId) {
						const photo = photos.find(p => p.id === photoId);
						if (photo) {
							lightboxPhoto = photo;
						}
					}
				});
			});
		});
	}

	function closeLightbox() {
		lightboxPhoto = null;
	}

	function createMarkerHtml(photo: PhotoWithUrl): string {
		const isSelected = photo.id === selectedPhotoId;
		const bearing = photo.bearing;
		const hasBearing = bearing !== null;

		if (hasBearing) {
			// Pin with direction arrow - uses larger container
			return `
				<div class="pin-marker-with-direction ${isSelected ? 'selected' : ''}">
					<div class="direction-arrow" style="transform: rotate(${bearing}deg)">
						<svg viewBox="0 0 24 40" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M12 0L8 12H11V40H13V12H16L12 0Z" fill="currentColor"/>
						</svg>
					</div>
					<div class="pin-center">
						<svg viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M16 0C7.163 0 0 7.163 0 16c0 10.512 14.112 24.768 15.168 25.824a1.2 1.2 0 0 0 1.664 0C17.888 40.768 32 26.512 32 16 32 7.163 24.837 0 16 0z" class="pin-body"/>
							<circle cx="16" cy="16" r="6" class="pin-dot"/>
						</svg>
					</div>
				</div>
			`;
		}

		// Simple pin without direction
		return `
			<div class="pin-marker ${isSelected ? 'selected' : ''}">
				<svg viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M16 0C7.163 0 0 7.163 0 16c0 10.512 14.112 24.768 15.168 25.824a1.2 1.2 0 0 0 1.664 0C17.888 40.768 32 26.512 32 16 32 7.163 24.837 0 16 0z" class="pin-body"/>
					<circle cx="16" cy="16" r="6" class="pin-dot"/>
				</svg>
			</div>
		`;
	}

	/**
	 * Pan map to center on a specific photo.
	 */
	export function panToPhoto(photoId: string) {
		const photo = photos.find((p) => p.id === photoId);
		if (!photo || !map) return;

		const coords = Photo.getCoordinates(photo);
		if (coords) {
			map.panTo(coords, { animate: true });
		}
	}

	/**
	 * Fit map to show all positioned photos.
	 */
	export function fitToPhotos() {
		const bounds = getBounds();
		if (bounds && map) {
			map.fitBounds(bounds, { padding: [50, 50] });
		}
	}

	/**
	 * Pan to default location.
	 */
	export function panToDefault() {
		if (map) {
			map.setView([defaultLat, defaultLng], defaultZoom, { animate: true });
		}
	}

	/**
	 * Open the popup for a specific photo.
	 */
	export function openPopup(photoId: string) {
		const marker = markers.get(photoId);
		if (marker) {
			marker.openPopup();
		}
	}

	// ============================================
	// Edit Mode Functions
	// ============================================

	function startEdit(photoId: string) {
		console.log('[PhotoMap] startEdit called for:', photoId);
		const photo = photos.find(p => p.id === photoId);
		if (!photo) {
			console.log('[PhotoMap] Photo not found in list');
			return;
		}
		if (!canEditPhoto(photo)) {
			console.log('[PhotoMap] User cannot edit this photo');
			return;
		}
		if (!map || !L) {
			console.log('[PhotoMap] Map or Leaflet not ready');
			return;
		}

		const coords = Photo.getCoordinates(photo);
		if (!coords) {
			console.log('[PhotoMap] Photo has no coordinates:', photo.latitude, photo.longitude);
			return;
		}
		console.log('[PhotoMap] Starting edit with coords:', coords);

		// Close any open popup
		map.closePopup();

		// Set edit state
		editingPhotoId = photoId;
		editPosition = { lat: coords[0], lng: coords[1] };
		editBearing = photo.bearing;
		// Convert ISO date to local date input format (YYYY-MM-DD)
		editDate = photo.date_taken ? photo.date_taken.split('T')[0] : null;

		// Make the marker draggable
		const marker = markers.get(photoId);
		if (marker) {
			marker.dragging?.enable();
			marker.on('drag', handleMarkerDrag);
		}

		// Create direction indicator
		createDirectionIndicator(coords[0], coords[1], photo.bearing);
	}

	function handleMarkerDrag() {
		const marker = editingPhotoId ? markers.get(editingPhotoId) : null;
		if (!marker) return;

		const pos = marker.getLatLng();
		editPosition = { lat: pos.lat, lng: pos.lng };

		// Update direction indicator position
		updateDirectionIndicator(pos.lat, pos.lng, editBearing);
	}

	function createDirectionIndicator(lat: number, lng: number, bearing: number | null) {
		if (!map || !L) return;

		// Remove existing indicator
		removeDirectionIndicator();

		// Calculate endpoint for direction line (about 30 meters away)
		const distance = 0.0003; // roughly 30 meters in degrees at mid-latitudes
		const currentBearing = bearing ?? 0;
		// Convert bearing to radians (bearing is clockwise from North)
		const bearingRad = currentBearing * (Math.PI / 180);
		// North = +lat, East = +lng
		const endLat = lat + distance * Math.cos(bearingRad);
		const endLng = lng + distance * Math.sin(bearingRad);

		// Create direction line
		directionLine = L.polyline(
			[[lat, lng], [endLat, endLng]],
			{
				color: '#ef4444',
				weight: 4,
				opacity: 0.9,
				dashArray: '8, 4'
			}
		).addTo(map);

		// Create draggable handle at the end
		const handleIcon = L.divIcon({
			html: `<div class="direction-handle">
				<svg viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
				</svg>
			</div>`,
			className: 'direction-handle-container',
			iconSize: [32, 32],
			iconAnchor: [16, 16]
		});

		directionHandle = L.marker([endLat, endLng], {
			icon: handleIcon,
			draggable: true
		}).addTo(map);

		// Handle drag to update bearing
		directionHandle.on('drag', () => {
			if (!directionHandle || !editPosition) return;

			const handlePos = directionHandle.getLatLng();
			const newBearing = calculateBearing(
				editPosition.lat, editPosition.lng,
				handlePos.lat, handlePos.lng
			);

			editBearing = Math.round(newBearing);

			// Update line
			if (directionLine) {
				directionLine.setLatLngs([
					[editPosition.lat, editPosition.lng],
					[handlePos.lat, handlePos.lng]
				]);
			}

			// Update handle rotation
			updateHandleRotation(newBearing);
		});

		// Set initial rotation
		updateHandleRotation(currentBearing);
	}

	function updateDirectionIndicator(lat: number, lng: number, bearing: number | null) {
		if (!directionLine || !directionHandle || !L) return;

		const distance = 0.0003;
		const currentBearing = bearing ?? 0;
		const bearingRad = currentBearing * (Math.PI / 180);
		const endLat = lat + distance * Math.cos(bearingRad);
		const endLng = lng + distance * Math.sin(bearingRad);

		directionLine.setLatLngs([[lat, lng], [endLat, endLng]]);
		directionHandle.setLatLng([endLat, endLng]);
	}

	function updateHandleRotation(bearing: number) {
		if (!directionHandle) return;
		const element = directionHandle.getElement();
		if (element) {
			const handle = element.querySelector('.direction-handle') as HTMLElement;
			if (handle) {
				handle.style.transform = `rotate(${bearing}deg)`;
			}
		}
	}

	function removeDirectionIndicator() {
		if (directionLine) {
			directionLine.remove();
			directionLine = null;
		}
		if (directionHandle) {
			directionHandle.remove();
			directionHandle = null;
		}
	}

	function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
		const dLng = (lng2 - lng1) * Math.PI / 180;
		const lat1Rad = lat1 * Math.PI / 180;
		const lat2Rad = lat2 * Math.PI / 180;

		const y = Math.sin(dLng) * Math.cos(lat2Rad);
		const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
			Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

		let bearing = Math.atan2(y, x) * 180 / Math.PI;
		return (bearing + 360) % 360;
	}

	function saveEdit() {
		if (!editingPhotoId || !editPosition || !onPhotoUpdate) return;

		// Convert local date to ISO format if present
		const dateTaken = editDate ? new Date(editDate + 'T12:00:00').toISOString() : null;
		onPhotoUpdate(editingPhotoId, editPosition.lat, editPosition.lng, editBearing, dateTaken);
		cancelEdit();
	}

	function cancelEdit() {
		if (!editingPhotoId) return;

		// Restore original marker position
		const photo = photos.find(p => p.id === editingPhotoId);
		const marker = markers.get(editingPhotoId);
		if (photo && marker) {
			const coords = Photo.getCoordinates(photo);
			if (coords) {
				marker.setLatLng(coords);
			}
			marker.dragging?.disable();
			marker.off('drag', handleMarkerDrag);
		}

		// Clean up
		removeDirectionIndicator();
		editingPhotoId = null;
		editPosition = null;
		editBearing = null;
		editDate = null;
	}

	// Expose startEdit for external use
	export function enterEditMode(photoId: string) {
		// Cancel any existing edit first
		if (editingPhotoId && editingPhotoId !== photoId) {
			cancelEdit();
		}
		startEdit(photoId);
	}

	// Expose cancelEdit for external use
	export function exitEditMode() {
		cancelEdit();
	}
</script>

<div class="relative h-full w-full">
	<div bind:this={mapContainer} class="h-full w-full"></div>

	<!-- Edit Mode Controls -->
	{#if isEditing && editingPhoto}
		<div class="edit-panel">
			<!-- Large photo preview -->
			<div class="edit-panel-photo">
				{#if editingPhoto.url}
					<img src={editingPhoto.url} alt={Photo.getDisplayTitle(editingPhoto)} />
				{:else}
					<div class="edit-panel-photo-placeholder">
						<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
							<rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
							<circle cx="9" cy="9" r="2" />
							<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
						</svg>
					</div>
				{/if}
			</div>

			<div class="edit-panel-header">
				<div class="edit-panel-title">Editing Location & Direction</div>
				<div class="edit-panel-subtitle">{Photo.getDisplayTitle(editingPhoto)}</div>
			</div>

			<div class="edit-panel-data">
				<div class="edit-data-row">
					<span class="edit-data-label">Position</span>
					<span class="edit-data-value">
						{editPosition?.lat.toFixed(6)}, {editPosition?.lng.toFixed(6)}
					</span>
				</div>
				<div class="edit-data-row">
					<span class="edit-data-label">Direction</span>
					<span class="edit-data-value">
						{#if editBearing !== null}
							{editBearing}° ({Photo.getBearingLabel({ ...editingPhoto, bearing: editBearing }) ?? 'N'})
						{:else}
							Not set (drag arrow)
						{/if}
					</span>
				</div>
				<div class="edit-data-row">
					<span class="edit-data-label">Date Taken</span>
					<input
						type="date"
						class="edit-date-input"
						value={editDate ?? ''}
						onchange={(e) => editDate = e.currentTarget.value || null}
					/>
				</div>
			</div>

			<div class="edit-panel-hint">
				<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10"/>
					<path d="M12 16v-4"/>
					<path d="M12 8h.01"/>
				</svg>
				<span>Drag the pin to move location. Drag the red arrow to set the direction the photo was taken.</span>
			</div>

			<div class="edit-panel-actions">
				<button class="edit-btn-cancel" onclick={cancelEdit}>
					Cancel
				</button>
				<button class="edit-btn-save" onclick={saveEdit}>
					Save Changes
				</button>
			</div>
		</div>
	{/if}

	<!-- Full-screen Lightbox -->
	{#if lightboxPhoto}
		<div
			class="lightbox-backdrop"
			onclick={closeLightbox}
			onkeydown={(e) => e.key === 'Escape' && closeLightbox()}
			role="button"
			tabindex="-1"
		>
			<button class="lightbox-close" onclick={closeLightbox} aria-label="Close full screen view">
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M18 6 6 18"/><path d="m6 6 12 12"/>
				</svg>
			</button>
			<div
				class="lightbox-content"
				role="presentation"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.stopPropagation()}
			>
				{#if Photo.isVideo(lightboxPhoto)}
					<!-- Video player for videos -->
					{#if lightboxPhoto.url}
						<video
							src={lightboxPhoto.url}
							controls
							autoplay
							class="lightbox-video"
							poster={lightboxPhoto.thumbnailUrl}
						>
							<track kind="captions" />
						</video>
					{/if}
				{:else}
					<!-- Image for photos -->
					{#if lightboxPhoto.url}
						<img src={lightboxPhoto.url} alt={Photo.getDisplayTitle(lightboxPhoto)} />
					{/if}
				{/if}
				<div class="lightbox-info">
					<div class="lightbox-title">
						{#if Photo.isVideo(lightboxPhoto)}
							<span class="lightbox-media-icon">🎬</span>
						{/if}
						{Photo.getDisplayTitle(lightboxPhoto)}
					</div>
					{#if Photo.formatDateTaken(lightboxPhoto)}
						<div class="lightbox-date">
							{Photo.getSeasonIcon(lightboxPhoto)} {Photo.formatDateTaken(lightboxPhoto)}
						</div>
					{/if}
					{#if Photo.isVideo(lightboxPhoto) && Photo.formatDuration(lightboxPhoto)}
						<div class="lightbox-duration">
							Duration: {Photo.formatDuration(lightboxPhoto)}
						</div>
					{/if}
					{#if lightboxPhoto.bearing !== null}
						<div class="lightbox-bearing">
							Facing {Photo.getBearingLabel(lightboxPhoto)} ({Math.round(lightboxPhoto.bearing)}°)
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<svelte:window onkeydown={(e) => e.key === 'Escape' && lightboxPhoto && closeLightbox()} />

<style>
	:global(.pin-marker-container) {
		background: transparent !important;
		border: none !important;
	}

	:global(.pin-marker) {
		width: 32px;
		height: 42px;
		cursor: pointer;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
		transition: transform 0.15s ease, filter 0.15s ease;
	}

	:global(.pin-marker:hover) {
		transform: scale(1.15);
		filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.4));
	}

	:global(.pin-marker svg) {
		width: 100%;
		height: 100%;
	}

	:global(.pin-marker .pin-body) {
		fill: hsl(var(--primary));
	}

	:global(.pin-marker .pin-dot) {
		fill: white;
	}

	:global(.pin-marker.selected .pin-body) {
		fill: hsl(var(--destructive));
	}

	:global(.pin-marker.selected) {
		transform: scale(1.2);
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.5));
	}

	/* Pin marker with direction arrow */
	:global(.pin-marker-with-direction) {
		position: relative;
		width: 80px;
		height: 80px;
		cursor: pointer;
	}

	:global(.pin-marker-with-direction .pin-center) {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: 32px;
		height: 42px;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
		transition: transform 0.15s ease, filter 0.15s ease;
		z-index: 2;
	}

	:global(.pin-marker-with-direction .pin-center svg) {
		width: 100%;
		height: 100%;
	}

	:global(.pin-marker-with-direction .pin-body) {
		fill: hsl(var(--primary));
	}

	:global(.pin-marker-with-direction .pin-dot) {
		fill: white;
	}

	:global(.pin-marker-with-direction .direction-arrow) {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 20px;
		height: 36px;
		margin-left: -10px;
		margin-top: -36px;
		transform-origin: center bottom;
		color: #dc2626;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
		z-index: 1;
	}

	:global(.pin-marker-with-direction .direction-arrow svg) {
		width: 100%;
		height: 100%;
	}

	:global(.pin-marker-with-direction:hover .pin-center) {
		filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.4));
	}

	:global(.pin-marker-with-direction.selected .pin-body) {
		fill: hsl(var(--destructive));
	}

	:global(.pin-marker-with-direction.selected .pin-center) {
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.5));
	}

	/* Photo popup styles */
	:global(.photo-popup .leaflet-popup-content-wrapper) {
		padding: 0;
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
	}

	:global(.photo-popup .leaflet-popup-content) {
		margin: 0;
		min-width: 200px;
	}

	:global(.photo-popup .leaflet-popup-tip) {
		background: white;
	}

	:global(.photo-popup-content) {
		display: flex;
		flex-direction: column;
	}

	:global(.photo-popup-image) {
		width: 100%;
		height: auto;
		max-height: 200px;
		object-fit: cover;
		display: block;
	}

	:global(.photo-popup-info) {
		padding: 12px;
		background: white;
	}

	:global(.photo-popup-title) {
		font-weight: 600;
		font-size: 14px;
		color: #1a1a1a;
		margin-bottom: 4px;
	}

	:global(.photo-popup-date) {
		font-size: 12px;
		color: #666;
	}

	:global(.photo-popup-bearing) {
		font-size: 12px;
		color: #666;
		margin-top: 2px;
	}

	:global(.photo-popup-image-container) {
		position: relative;
	}

	:global(.photo-popup-expand-btn) {
		position: absolute;
		top: 8px;
		right: 8px;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.6);
		border: none;
		border-radius: 6px;
		color: white;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s ease, background 0.15s ease;
	}

	:global(.photo-popup-image-container:hover .photo-popup-expand-btn) {
		opacity: 1;
	}

	:global(.photo-popup-expand-btn:hover) {
		background: rgba(0, 0, 0, 0.8);
	}

	:global(.photo-popup-bearing-arrow) {
		position: absolute;
		bottom: 8px;
		right: 8px;
		width: 28px;
		height: 28px;
		background: rgba(0, 0, 0, 0.6);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ef4444;
		padding: 4px;
	}

	:global(.photo-popup-bearing-arrow svg) {
		width: 100%;
		height: 100%;
	}

	:global(.photo-popup-video-play) {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 48px;
		height: 48px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.6);
		border-radius: 50%;
		color: white;
		pointer-events: none;
	}

	:global(.photo-popup-video-play svg) {
		margin-left: 3px;
	}

	:global(.photo-popup-duration) {
		position: absolute;
		bottom: 8px;
		left: 8px;
		padding: 2px 6px;
		background: rgba(0, 0, 0, 0.75);
		border-radius: 4px;
		color: white;
		font-size: 11px;
		font-weight: 500;
	}

	:global(.photo-popup-actions) {
		display: flex;
		gap: 8px;
		margin-top: 10px;
	}

	:global(.photo-popup-action-btn) {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 8px 12px;
		border: 1px solid #e5e5e5;
		border-radius: 6px;
		background: white;
		color: #333;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	:global(.photo-popup-action-btn:hover) {
		background: #f5f5f5;
		border-color: #ccc;
	}

	:global(.photo-popup-edit-btn) {
		background: hsl(var(--primary));
		border-color: hsl(var(--primary));
		color: white;
	}

	:global(.photo-popup-edit-btn:hover) {
		background: hsl(var(--primary) / 0.9);
		border-color: hsl(var(--primary) / 0.9);
	}

	/* Direction handle */
	:global(.direction-handle-container) {
		background: transparent !important;
		border: none !important;
	}

	:global(.direction-handle) {
		width: 32px;
		height: 32px;
		color: #ef4444;
		cursor: grab;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
		transition: transform 0.1s ease;
	}

	:global(.direction-handle:active) {
		cursor: grabbing;
	}

	:global(.direction-handle svg) {
		width: 100%;
		height: 100%;
	}

	/* Edit panel */
	.edit-panel {
		position: absolute;
		top: 16px;
		left: 16px;
		z-index: 1000;
		background: white;
		border-radius: 12px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
		width: 320px;
		max-height: calc(100vh - 120px);
		overflow-y: auto;
	}

	.edit-panel-photo {
		width: 100%;
		aspect-ratio: 4 / 3;
		background: #000;
		overflow: hidden;
	}

	.edit-panel-photo img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.edit-panel-photo-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: hsl(var(--muted-foreground));
		background: hsl(var(--muted));
	}

	.edit-panel-header {
		padding: 12px;
		border-bottom: 1px solid hsl(var(--border));
	}

	.edit-panel-title {
		font-size: 11px;
		font-weight: 600;
		color: hsl(var(--primary));
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 2px;
	}

	.edit-panel-subtitle {
		font-size: 14px;
		font-weight: 600;
		color: hsl(var(--foreground));
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.edit-panel-data {
		padding: 12px;
		border-bottom: 1px solid hsl(var(--border));
	}

	.edit-data-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 0;
	}

	.edit-data-label {
		font-size: 12px;
		color: hsl(var(--muted-foreground));
	}

	.edit-data-value {
		font-size: 12px;
		font-weight: 500;
		font-family: ui-monospace, monospace;
	}

	.edit-date-input {
		font-size: 12px;
		font-weight: 500;
		padding: 4px 8px;
		border: 1px solid hsl(var(--border));
		border-radius: 4px;
		background: hsl(var(--background));
		color: hsl(var(--foreground));
	}

	.edit-date-input:focus {
		outline: none;
		border-color: hsl(var(--primary));
		box-shadow: 0 0 0 2px hsl(var(--primary) / 0.2);
	}

	.edit-panel-hint {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 12px;
		background: hsl(var(--muted) / 0.5);
		font-size: 12px;
		color: hsl(var(--muted-foreground));
	}

	.edit-panel-hint svg {
		flex-shrink: 0;
		margin-top: 1px;
	}

	.edit-panel-actions {
		display: flex;
		gap: 8px;
		padding: 12px;
	}

	.edit-btn-cancel,
	.edit-btn-save {
		flex: 1;
		padding: 10px 16px;
		border-radius: 8px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.edit-btn-cancel {
		background: white;
		border: 1px solid hsl(var(--border));
		color: hsl(var(--foreground));
	}

	.edit-btn-cancel:hover {
		background: hsl(var(--muted));
	}

	.edit-btn-save {
		background: hsl(var(--primary));
		border: 1px solid hsl(var(--primary));
		color: white;
	}

	.edit-btn-save:hover {
		background: hsl(var(--primary) / 0.9);
	}

	/* Lightbox styles */
	.lightbox-backdrop {
		position: fixed;
		inset: 0;
		z-index: 9999;
		background: rgba(0, 0, 0, 0.92);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.lightbox-close {
		position: absolute;
		top: 16px;
		right: 16px;
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.1);
		border: none;
		border-radius: 50%;
		color: white;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.lightbox-close:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.lightbox-content {
		max-width: 90vw;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		cursor: default;
	}

	.lightbox-content img {
		max-width: 100%;
		max-height: calc(90vh - 80px);
		object-fit: contain;
		border-radius: 4px;
	}

	.lightbox-content :global(.lightbox-video) {
		max-width: 100%;
		max-height: calc(90vh - 80px);
		border-radius: 4px;
		background: black;
	}

	.lightbox-info {
		padding: 16px 8px;
		text-align: center;
		color: white;
	}

	.lightbox-title {
		font-size: 16px;
		font-weight: 600;
		margin-bottom: 4px;
	}

	.lightbox-media-icon {
		margin-right: 4px;
	}

	.lightbox-date {
		font-size: 14px;
		color: rgba(255, 255, 255, 0.7);
	}

	.lightbox-duration {
		font-size: 14px;
		color: rgba(255, 255, 255, 0.7);
		margin-top: 2px;
	}

	.lightbox-bearing {
		font-size: 14px;
		color: rgba(255, 255, 255, 0.7);
		margin-top: 2px;
	}
</style>

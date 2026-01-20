<script lang="ts">
	import { extractExifData, stripExifData } from '../exif';
	import type { ExifData, MediaType } from '../photo.schema';

	interface UploadedFile {
		file: File;
		strippedFile: File;
		exifData: ExifData;
		preview: string;
		mediaType: MediaType;
		duration: number | null;
		thumbnailBlob: Blob | null;
	}

	interface Props {
		onUpload: (files: UploadedFile[]) => void;
		disabled?: boolean;
		multiple?: boolean;
		maxFileSizeMB?: number;
	}

	let { onUpload, disabled = false, multiple = true, maxFileSizeMB = 50 }: Props = $props();

	let isDragging = $state(false);
	let isProcessing = $state(false);
	let uploadError = $state<string | null>(null);
	let fileInput: HTMLInputElement;

	// Supported MIME types
	const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
	const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
	const ACCEPTED_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES];

	// File extension patterns
	const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp)$/i;
	const VIDEO_EXTENSIONS = /\.(mp4|mov|webm)$/i;

	function isVideoFile(file: File): boolean {
		return VIDEO_TYPES.includes(file.type) || VIDEO_EXTENSIONS.test(file.name);
	}

	function isImageFile(file: File): boolean {
		return IMAGE_TYPES.includes(file.type) || IMAGE_EXTENSIONS.test(file.name);
	}

	function isAcceptedFile(file: File): boolean {
		return isVideoFile(file) || isImageFile(file);
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (!disabled) {
			isDragging = true;
		}
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		uploadError = null;

		if (disabled || !e.dataTransfer?.files) return;

		const files = Array.from(e.dataTransfer.files).filter(isAcceptedFile);

		if (files.length > 0) {
			await processFiles(files);
		}
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (!input.files || disabled) return;
		uploadError = null;

		const files = Array.from(input.files).filter(isAcceptedFile);
		if (files.length > 0) {
			processFiles(files);
		}

		// Reset input so the same file can be selected again
		input.value = '';
	}

	// Thumbnail settings
	const THUMBNAIL_MAX_SIZE = 400; // Max width or height in pixels
	const THUMBNAIL_QUALITY = 0.85;

	/**
	 * Generate a thumbnail for an image file.
	 * Resizes to fit within THUMBNAIL_MAX_SIZE while maintaining aspect ratio.
	 */
	async function generateImageThumbnail(file: File): Promise<Blob> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			const url = URL.createObjectURL(file);

			img.onload = () => {
				// Calculate thumbnail dimensions maintaining aspect ratio
				let width = img.width;
				let height = img.height;

				if (width > height) {
					if (width > THUMBNAIL_MAX_SIZE) {
						height = Math.round((height * THUMBNAIL_MAX_SIZE) / width);
						width = THUMBNAIL_MAX_SIZE;
					}
				} else {
					if (height > THUMBNAIL_MAX_SIZE) {
						width = Math.round((width * THUMBNAIL_MAX_SIZE) / height);
						height = THUMBNAIL_MAX_SIZE;
					}
				}

				// Create canvas and draw resized image
				const canvas = document.createElement('canvas');
				canvas.width = width;
				canvas.height = height;

				const ctx = canvas.getContext('2d');
				if (!ctx) {
					URL.revokeObjectURL(url);
					reject(new Error('Failed to get canvas context'));
					return;
				}

				ctx.drawImage(img, 0, 0, width, height);

				// Convert to JPEG blob
				canvas.toBlob(
					(blob) => {
						URL.revokeObjectURL(url);
						if (!blob) {
							reject(new Error('Failed to create thumbnail blob'));
							return;
						}
						resolve(blob);
					},
					'image/jpeg',
					THUMBNAIL_QUALITY
				);
			};

			img.onerror = () => {
				URL.revokeObjectURL(url);
				reject(new Error('Failed to load image'));
			};

			img.src = url;
		});
	}

	/**
	 * Extract video metadata and generate thumbnail from first frame.
	 */
	async function processVideo(file: File): Promise<{
		duration: number;
		thumbnailBlob: Blob;
		preview: string;
	}> {
		return new Promise((resolve, reject) => {
			const video = document.createElement('video');
			video.preload = 'metadata';
			video.muted = true;
			video.playsInline = true;

			const url = URL.createObjectURL(file);
			video.src = url;

			video.onloadedmetadata = () => {
				const duration = video.duration;

				// Seek to first frame
				video.currentTime = 0.1; // Small offset to ensure we get a frame

				video.onseeked = () => {
					// Create canvas and draw video frame
					const canvas = document.createElement('canvas');
					canvas.width = video.videoWidth;
					canvas.height = video.videoHeight;

					const ctx = canvas.getContext('2d');
					if (!ctx) {
						URL.revokeObjectURL(url);
						reject(new Error('Failed to get canvas context'));
						return;
					}

					ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

					// Convert to JPEG blob
					canvas.toBlob(
						(blob) => {
							if (!blob) {
								URL.revokeObjectURL(url);
								reject(new Error('Failed to create thumbnail blob'));
								return;
							}

							resolve({
								duration,
								thumbnailBlob: blob,
								preview: URL.createObjectURL(blob)
							});

							// Clean up video URL (keep thumbnail URL for preview)
							URL.revokeObjectURL(url);
						},
						'image/jpeg',
						0.85
					);
				};

				video.onerror = () => {
					URL.revokeObjectURL(url);
					reject(new Error('Failed to seek video'));
				};
			};

			video.onerror = () => {
				URL.revokeObjectURL(url);
				reject(new Error('Failed to load video metadata'));
			};
		});
	}

	async function processFiles(files: File[]) {
		isProcessing = true;
		uploadError = null;

		try {
			const uploadedFiles: UploadedFile[] = [];
			const maxBytes = maxFileSizeMB * 1024 * 1024;

			for (const file of files) {
				// Check file size
				if (file.size > maxBytes) {
					uploadError = `File "${file.name}" exceeds ${maxFileSizeMB}MB limit`;
					continue;
				}

				if (isVideoFile(file)) {
					// Process video
					try {
						console.log('[PhotoUploader] Processing video:', file.name, file.size, file.type);
						const { duration, thumbnailBlob, preview } = await processVideo(file);
						console.log('[PhotoUploader] Video processed. Duration:', duration, 'Thumbnail size:', thumbnailBlob.size);

						// Use file's lastModified as the date (best we can get from browser)
						const dateTaken = file.lastModified
							? new Date(file.lastModified).toISOString()
							: null;

						uploadedFiles.push({
							file,
							strippedFile: file, // Videos don't need EXIF stripping
							exifData: {
								dateTaken // Use file modification date
							},
							preview,
							mediaType: 'video',
							duration,
							thumbnailBlob
						});
					} catch (err) {
						console.error('[PhotoUploader] Error processing video:', err);
						uploadError = `Failed to process video "${file.name}"`;
					}
				} else {
					// Process image
					try {
						console.log('[PhotoUploader] Processing image:', file.name, file.size, file.type);
						const exifData = await extractExifData(file);
						const strippedFile = await stripExifData(file);

						// Generate thumbnail from the stripped file
						const thumbnailBlob = await generateImageThumbnail(strippedFile);
						console.log('[PhotoUploader] Image processed. Thumbnail size:', thumbnailBlob.size);

						// Use thumbnail for preview (faster rendering)
						const preview = URL.createObjectURL(thumbnailBlob);

						uploadedFiles.push({
							file,
							strippedFile,
							exifData,
							preview,
							mediaType: 'photo',
							duration: null,
							thumbnailBlob
						});
					} catch (err) {
						console.error('[PhotoUploader] Error processing image:', err);
						uploadError = `Failed to process image "${file.name}"`;
					}
				}
			}

			if (uploadedFiles.length > 0) {
				onUpload(uploadedFiles);
			}
		} catch (error) {
			console.error('Error processing files:', error);
			uploadError = 'An error occurred while processing files';
		} finally {
			isProcessing = false;
		}
	}

	function openFilePicker() {
		if (!disabled) {
			fileInput.click();
		}
	}
</script>

<div
	class="upload-zone"
	class:dragging={isDragging}
	class:disabled
	class:processing={isProcessing}
	role="button"
	tabindex="0"
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	onclick={openFilePicker}
	onkeydown={(e) => e.key === 'Enter' && openFilePicker()}
>
	<input
		bind:this={fileInput}
		type="file"
		accept="image/*,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
		{multiple}
		{disabled}
		onchange={handleFileSelect}
		class="hidden"
	/>

	<div class="upload-content">
		{#if isProcessing}
			<div class="spinner"></div>
			<p class="text-sm font-medium">Processing files...</p>
			<p class="text-xs text-muted-foreground">Extracting metadata</p>
		{:else}
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
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<polyline points="17 8 12 3 7 8" />
				<line x1="12" x2="12" y1="3" y2="15" />
			</svg>
			<p class="mt-4 text-sm font-medium">
				{isDragging ? 'Drop files here' : 'Drag photos or videos here'}
			</p>
			<p class="text-xs text-muted-foreground">
				Photos: GPS will be extracted. Videos: max {maxFileSizeMB}MB
			</p>
			{#if uploadError}
				<p class="mt-2 text-xs text-destructive">{uploadError}</p>
			{/if}
		{/if}
	</div>
</div>

<style>
	.upload-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		border: 2px dashed hsl(var(--border));
		border-radius: var(--radius);
		background-color: hsl(var(--muted) / 0.3);
		cursor: pointer;
		transition: all 0.2s ease;
		min-height: 200px;
	}

	.upload-zone:hover:not(.disabled):not(.processing) {
		border-color: hsl(var(--primary));
		background-color: hsl(var(--primary) / 0.05);
	}

	.upload-zone.dragging {
		border-color: hsl(var(--primary));
		background-color: hsl(var(--primary) / 0.1);
		transform: scale(1.02);
	}

	.upload-zone.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.upload-zone.processing {
		cursor: wait;
	}

	.upload-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid hsl(var(--muted));
		border-top-color: hsl(var(--primary));
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.hidden {
		display: none;
	}
</style>

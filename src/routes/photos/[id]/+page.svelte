<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import { Photo } from '$lib/apps/photos';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	let isEditing = $state(false);
	let isDeleting = $state(false);

	const displayTitle = $derived(Photo.getDisplayTitle(data.photo));
	const dateTaken = $derived(Photo.formatDateTaken(data.photo));
	const seasonIcon = $derived(Photo.getSeasonIcon(data.photo));
	const bearingLabel = $derived(Photo.getBearingLabel(data.photo));
	const hasLocation = $derived(Photo.hasLocation(data.photo));
	const coordinates = $derived(Photo.getCoordinates(data.photo));

	// Format date for input field
	const dateInputValue = $derived(
		data.photo.date_taken ? data.photo.date_taken.split('T')[0] : ''
	);
</script>

<svelte:head>
	<title>{displayTitle} - Property Photo Map</title>
</svelte:head>

<div class="min-h-screen bg-background">
	<!-- Header -->
	<header class="border-b">
		<div class="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
			<a href="/photos" class="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
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
					<path d="m12 19-7-7 7-7" />
					<path d="M19 12H5" />
				</svg>
				Back to Map
			</a>

			<div class="flex items-center gap-2">
				<button
					type="button"
					class="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
					onclick={() => (isEditing = !isEditing)}
				>
					{isEditing ? 'Cancel' : 'Edit'}
				</button>
			</div>
		</div>
	</header>

	<!-- Content -->
	<main class="mx-auto max-w-4xl px-4 py-8">
		{#if form?.error}
			<div class="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
				{form.error}
			</div>
		{/if}

		{#if form?.success}
			<div class="mb-4 rounded-md border border-primary/50 bg-primary/10 p-3 text-sm text-primary">
				Photo updated successfully
			</div>
		{/if}

		<div class="grid gap-8 md:grid-cols-2">
			<!-- Photo -->
			<div class="overflow-hidden rounded-lg bg-black">
				{#if data.photo.url}
					<img
						src={data.photo.url}
						alt={displayTitle}
						class="h-auto w-full object-contain"
					/>
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

			<!-- Details -->
			<div class="space-y-6">
				{#if isEditing}
					<form
						method="POST"
						action="?/update"
						use:enhance
						class="space-y-4"
					>
						<div class="space-y-2">
							<label for="title" class="text-sm font-medium">Title</label>
							<input
								id="title"
								name="title"
								type="text"
								value={data.photo.title ?? ''}
								class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								placeholder="Enter a title"
							/>
						</div>

						<div class="space-y-2">
							<label for="description" class="text-sm font-medium">Description</label>
							<textarea
								id="description"
								name="description"
								rows="3"
								class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								placeholder="Add a description"
							>{data.photo.description ?? ''}</textarea>
						</div>

						<div class="space-y-2">
							<label for="dateTaken" class="text-sm font-medium">Date Taken</label>
							<input
								id="dateTaken"
								name="dateTaken"
								type="date"
								value={dateInputValue}
								class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>

						<div class="flex gap-2">
							<button
								type="submit"
								class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
							>
								Save Changes
							</button>
							<button
								type="button"
								class="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
								onclick={() => (isEditing = false)}
							>
								Cancel
							</button>
						</div>
					</form>
				{:else}
					<div>
						<h1 class="text-2xl font-semibold">{displayTitle}</h1>
						{#if data.photo.description}
							<p class="mt-2 text-muted-foreground">{data.photo.description}</p>
						{/if}
					</div>

					<div class="space-y-4">
						{#if dateTaken}
							<div>
								<h3 class="text-sm font-medium text-muted-foreground">Date Taken</h3>
								<p class="mt-1">
									<span class="mr-1">{seasonIcon}</span>
									{dateTaken}
								</p>
								<p class="text-xs text-muted-foreground">
									Source: {data.photo.date_source}
								</p>
							</div>
						{/if}

						<div>
							<h3 class="text-sm font-medium text-muted-foreground">Location</h3>
							{#if hasLocation && coordinates}
								<p class="mt-1 text-sm">
									{coordinates[0].toFixed(6)}, {coordinates[1].toFixed(6)}
								</p>
								<p class="text-xs text-muted-foreground">
									Source: {data.photo.position_source}
								</p>
							{:else}
								<p class="mt-1 text-sm text-destructive">Not positioned on map</p>
							{/if}
						</div>

						{#if bearingLabel}
							<div>
								<h3 class="text-sm font-medium text-muted-foreground">Direction Facing</h3>
								<p class="mt-1">{bearingLabel} ({data.photo.bearing}°)</p>
							</div>
						{/if}

						<div>
							<h3 class="text-sm font-medium text-muted-foreground">File</h3>
							<p class="mt-1 text-sm">{data.photo.filename}</p>
						</div>
					</div>
				{/if}

				<!-- Delete section -->
				<div class="border-t pt-6">
					<h3 class="text-sm font-medium text-destructive">Danger Zone</h3>
					<p class="mt-1 text-sm text-muted-foreground">
						Permanently delete this photo. This action cannot be undone.
					</p>

					{#if isDeleting}
						<form
							method="POST"
							action="?/delete"
							use:enhance
							class="mt-4"
						>
							<p class="mb-3 text-sm font-medium">
								Are you sure you want to delete this photo?
							</p>
							<div class="flex gap-2">
								<button
									type="submit"
									class="inline-flex items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
								>
									Yes, Delete
								</button>
								<button
									type="button"
									class="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
									onclick={() => (isDeleting = false)}
								>
									Cancel
								</button>
							</div>
						</form>
					{:else}
						<button
							type="button"
							class="mt-4 inline-flex items-center justify-center rounded-md border border-destructive bg-background px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
							onclick={() => (isDeleting = true)}
						>
							Delete Photo
						</button>
					{/if}
				</div>
			</div>
		</div>
	</main>
</div>

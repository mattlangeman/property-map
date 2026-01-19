<script lang="ts">
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
</script>

<svelte:head>
	<title>Property Photo Map</title>
</svelte:head>

<main class="flex min-h-screen flex-col items-center justify-center p-8">
	<div class="max-w-md text-center">
		<h1 class="mb-4 text-4xl font-bold text-primary">Property Photo Map</h1>
		<p class="mb-8 text-muted-foreground">
			Map your property photos with GPS coordinates to track changes throughout the seasons.
		</p>

		{#if data.user}
			<div class="space-y-4">
				<p class="text-sm text-muted-foreground">
					Signed in as <span class="font-medium">{data.user.email}</span>
				</p>
				<div class="flex flex-col gap-2">
					<a
						href="/photos"
						class="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
					>
						View Photo Map
					</a>
					<form action="/auth/logout" method="POST">
						<button
							type="submit"
							class="w-full rounded-md border border-input bg-background px-6 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
						>
							Sign Out
						</button>
					</form>
				</div>
			</div>
		{:else}
			<div class="flex flex-col gap-2">
				<a
					href="/auth/login"
					class="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
				>
					Sign In
				</a>
				<a
					href="/auth/signup"
					class="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
				>
					Create Account
				</a>
			</div>
		{/if}
	</div>
</main>

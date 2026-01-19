<script lang="ts">
	import type { ActionData } from './$types';
	import { enhance } from '$app/forms';

	interface Props {
		form: ActionData;
	}

	let { form }: Props = $props();
	let isLoading = $state(false);
</script>

<svelte:head>
	<title>Sign In - Property Photo Map</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center p-8">
	<div class="w-full max-w-sm">
		<div class="mb-8 text-center">
			<h1 class="text-2xl font-bold">Sign In</h1>
			<p class="mt-2 text-sm text-muted-foreground">
				Enter your email and password to access your photos
			</p>
		</div>

		{#if form?.error}
			<div class="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
				{form.error}
			</div>
		{/if}

		<form
			method="POST"
			use:enhance={() => {
				isLoading = true;
				return async ({ update }) => {
					isLoading = false;
					await update();
				};
			}}
			class="space-y-4"
		>
			<div class="space-y-2">
				<label for="email" class="text-sm font-medium">Email</label>
				<input
					id="email"
					name="email"
					type="email"
					required
					autocomplete="email"
					value={form?.values?.email ?? ''}
					class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
					placeholder="you@example.com"
				/>
			</div>

			<div class="space-y-2">
				<label for="password" class="text-sm font-medium">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					required
					autocomplete="current-password"
					class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
					placeholder="Enter your password"
				/>
			</div>

			<button
				type="submit"
				disabled={isLoading}
				class="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{isLoading ? 'Signing in...' : 'Sign In'}
			</button>
		</form>

		<p class="mt-6 text-center text-sm text-muted-foreground">
			Don't have an account?
			<a href="/auth/signup" class="font-medium text-primary hover:underline">Sign up</a>
		</p>

		<a
			href="/"
			class="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground"
		>
			Back to home
		</a>
	</div>
</main>

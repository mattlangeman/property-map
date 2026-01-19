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
	<title>Create Account - Property Photo Map</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center p-8">
	<div class="w-full max-w-sm">
		<div class="mb-8 text-center">
			<h1 class="text-2xl font-bold">Create Account</h1>
			<p class="mt-2 text-sm text-muted-foreground">
				Sign up to start mapping your property photos
			</p>
		</div>

		{#if form?.success}
			<div class="mb-4 rounded-md border border-primary/50 bg-primary/10 p-3 text-sm text-primary">
				Check your email for a confirmation link to complete your registration.
			</div>
		{/if}

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
					autocomplete="new-password"
					minlength="6"
					class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
					placeholder="At least 6 characters"
				/>
			</div>

			<div class="space-y-2">
				<label for="confirmPassword" class="text-sm font-medium">Confirm Password</label>
				<input
					id="confirmPassword"
					name="confirmPassword"
					type="password"
					required
					autocomplete="new-password"
					minlength="6"
					class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
					placeholder="Confirm your password"
				/>
			</div>

			<button
				type="submit"
				disabled={isLoading}
				class="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{isLoading ? 'Creating account...' : 'Create Account'}
			</button>
		</form>

		<p class="mt-6 text-center text-sm text-muted-foreground">
			Already have an account?
			<a href="/auth/login" class="font-medium text-primary hover:underline">Sign in</a>
		</p>

		<a
			href="/"
			class="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground"
		>
			Back to home
		</a>
	</div>
</main>

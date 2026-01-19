<script lang="ts">
	import '../app.css';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';

	interface Props {
		children: import('svelte').Snippet;
		data: {
			session: import('@supabase/supabase-js').Session | null;
			supabase: import('@supabase/supabase-js').SupabaseClient;
		};
	}

	let { children, data }: Props = $props();

	onMount(() => {
		// Listen for auth state changes and invalidate data when they occur
		const { data: authData } = data.supabase.auth.onAuthStateChange((event, _session) => {
			if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
				invalidate('supabase:auth');
			}
		});

		return () => {
			authData.subscription.unsubscribe();
		};
	});
</script>

<div class="min-h-screen bg-background">
	{@render children()}
</div>

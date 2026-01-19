<script lang="ts">
	interface Props {
		hasLocationFilter: boolean | null;
		startDate: string | null;
		endDate: string | null;
		onFilterChange: (filters: {
			hasLocation: boolean | null;
			startDate: string | null;
			endDate: string | null;
		}) => void;
	}

	let { hasLocationFilter, startDate, endDate, onFilterChange }: Props = $props();

	function handleLocationFilterChange(value: string) {
		const hasLocation = value === '' ? null : value === 'true';
		onFilterChange({ hasLocation, startDate, endDate });
	}

	function handleStartDateChange(e: Event) {
		const value = (e.target as HTMLInputElement).value;
		onFilterChange({
			hasLocation: hasLocationFilter,
			startDate: value || null,
			endDate
		});
	}

	function handleEndDateChange(e: Event) {
		const value = (e.target as HTMLInputElement).value;
		onFilterChange({
			hasLocation: hasLocationFilter,
			startDate,
			endDate: value || null
		});
	}

	function clearFilters() {
		onFilterChange({
			hasLocation: null,
			startDate: null,
			endDate: null
		});
	}

	const hasActiveFilters = $derived(
		hasLocationFilter !== null || startDate !== null || endDate !== null
	);
</script>

<div class="photo-filters">
	<div class="filter-group">
		<label for="location-filter" class="filter-label">Location</label>
		<select
			id="location-filter"
			class="filter-select"
			value={hasLocationFilter === null ? '' : String(hasLocationFilter)}
			onchange={(e) => handleLocationFilterChange((e.target as HTMLSelectElement).value)}
		>
			<option value="">All photos</option>
			<option value="true">Positioned</option>
			<option value="false">Needs positioning</option>
		</select>
	</div>

	<div class="filter-group">
		<label for="start-date" class="filter-label">From</label>
		<input
			id="start-date"
			type="date"
			class="filter-input"
			value={startDate ?? ''}
			onchange={handleStartDateChange}
		/>
	</div>

	<div class="filter-group">
		<label for="end-date" class="filter-label">To</label>
		<input
			id="end-date"
			type="date"
			class="filter-input"
			value={endDate ?? ''}
			onchange={handleEndDateChange}
		/>
	</div>

	{#if hasActiveFilters}
		<button type="button" class="clear-button" onclick={clearFilters}>
			Clear filters
		</button>
	{/if}
</div>

<style>
	.photo-filters {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 1rem;
		padding: 1rem;
		background: hsl(var(--muted) / 0.3);
		border-radius: var(--radius);
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.filter-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: hsl(var(--muted-foreground));
	}

	.filter-select,
	.filter-input {
		height: 36px;
		padding: 0 0.75rem;
		border: 1px solid hsl(var(--border));
		border-radius: var(--radius);
		background: hsl(var(--background));
		font-size: 0.875rem;
		color: hsl(var(--foreground));
	}

	.filter-select:focus,
	.filter-input:focus {
		outline: none;
		border-color: hsl(var(--ring));
		box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
	}

	.clear-button {
		height: 36px;
		padding: 0 0.75rem;
		border: none;
		border-radius: var(--radius);
		background: transparent;
		font-size: 0.875rem;
		color: hsl(var(--muted-foreground));
		cursor: pointer;
		transition: color 0.15s ease;
	}

	.clear-button:hover {
		color: hsl(var(--foreground));
	}
</style>

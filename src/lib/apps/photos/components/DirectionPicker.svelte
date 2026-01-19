<script lang="ts">
	interface Props {
		bearing: number | null;
		onChange: (bearing: number) => void;
		size?: number;
	}

	let { bearing, onChange, size = 120 }: Props = $props();

	let isDragging = $state(false);
	let compassElement: HTMLDivElement;

	// Cardinal directions for labels
	const directions = [
		{ label: 'N', angle: 0 },
		{ label: 'E', angle: 90 },
		{ label: 'S', angle: 180 },
		{ label: 'W', angle: 270 }
	];

	function handleMouseDown(e: MouseEvent) {
		isDragging = true;
		updateBearing(e);
	}

	function handleMouseMove(e: MouseEvent) {
		if (isDragging) {
			updateBearing(e);
		}
	}

	function handleMouseUp() {
		isDragging = false;
	}

	function handleTouchStart(e: TouchEvent) {
		isDragging = true;
		updateBearingFromTouch(e);
	}

	function handleTouchMove(e: TouchEvent) {
		if (isDragging) {
			e.preventDefault();
			updateBearingFromTouch(e);
		}
	}

	function handleTouchEnd() {
		isDragging = false;
	}

	function updateBearing(e: MouseEvent) {
		if (!compassElement) return;

		const rect = compassElement.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;

		const angle = calculateAngle(e.clientX - centerX, e.clientY - centerY);
		onChange(angle);
	}

	function updateBearingFromTouch(e: TouchEvent) {
		if (!compassElement || e.touches.length === 0) return;

		const rect = compassElement.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;

		const touch = e.touches[0];
		const angle = calculateAngle(touch.clientX - centerX, touch.clientY - centerY);
		onChange(angle);
	}

	function calculateAngle(x: number, y: number): number {
		// atan2 gives angle from positive X axis (East), we want from North
		let angle = Math.atan2(x, -y) * (180 / Math.PI);
		// Normalize to 0-360
		if (angle < 0) angle += 360;
		return Math.round(angle);
	}

	// Handle keyboard navigation
	function handleKeyDown(e: KeyboardEvent) {
		if (!bearing && bearing !== 0) return;

		let newBearing = bearing;
		switch (e.key) {
			case 'ArrowLeft':
				newBearing = (bearing - 15 + 360) % 360;
				break;
			case 'ArrowRight':
				newBearing = (bearing + 15) % 360;
				break;
			case 'ArrowUp':
				newBearing = 0; // North
				break;
			case 'ArrowDown':
				newBearing = 180; // South
				break;
			default:
				return;
		}
		e.preventDefault();
		onChange(newBearing);
	}

	function getBearingLabel(bearing: number): string {
		const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
		const index = Math.round(bearing / 45) % 8;
		return dirs[index];
	}
</script>

<svelte:window onmouseup={handleMouseUp} onmousemove={handleMouseMove} />

<div class="direction-picker" style="--size: {size}px">
	<div
		bind:this={compassElement}
		class="compass"
		class:dragging={isDragging}
		role="slider"
		aria-label="Direction picker"
		aria-valuemin="0"
		aria-valuemax="360"
		aria-valuenow={bearing ?? 0}
		tabindex="0"
		onmousedown={handleMouseDown}
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
		onkeydown={handleKeyDown}
	>
		<!-- Compass rose background -->
		<div class="compass-bg">
			{#each directions as dir}
				<span
					class="direction-label"
					style="transform: rotate({dir.angle}deg) translateY(-{size / 2 - 16}px) rotate(-{dir.angle}deg)"
				>
					{dir.label}
				</span>
			{/each}
		</div>

		<!-- Direction indicator -->
		{#if bearing !== null}
			<div class="indicator" style="transform: rotate({bearing}deg)">
				<div class="arrow"></div>
			</div>
		{/if}

		<!-- Center dot -->
		<div class="center-dot"></div>
	</div>

	<!-- Bearing value -->
	<div class="bearing-value">
		{#if bearing !== null}
			<span class="font-medium">{bearing}°</span>
			<span class="text-muted-foreground text-xs">
				({getBearingLabel(bearing)})
			</span>
		{:else}
			<span class="text-muted-foreground">Click to set direction</span>
		{/if}
	</div>
</div>

<style>
	.direction-picker {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.compass {
		position: relative;
		width: var(--size);
		height: var(--size);
		border-radius: 50%;
		background: hsl(var(--muted));
		border: 2px solid hsl(var(--border));
		cursor: crosshair;
		user-select: none;
		touch-action: none;
	}

	.compass:focus {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}

	.compass.dragging {
		border-color: hsl(var(--primary));
	}

	.compass-bg {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.direction-label {
		position: absolute;
		font-size: 12px;
		font-weight: 500;
		color: hsl(var(--muted-foreground));
	}

	.indicator {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 2px;
		height: calc(var(--size) / 2 - 8px);
		transform-origin: bottom center;
		margin-left: -1px;
		margin-top: calc(-1 * (var(--size) / 2 - 8px));
	}

	.arrow {
		position: absolute;
		top: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 0;
		height: 0;
		border-left: 8px solid transparent;
		border-right: 8px solid transparent;
		border-bottom: 20px solid hsl(var(--primary));
	}

	.center-dot {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 12px;
		height: 12px;
		background: hsl(var(--background));
		border: 2px solid hsl(var(--primary));
		border-radius: 50%;
		transform: translate(-50%, -50%);
	}

	.bearing-value {
		text-align: center;
		font-size: 14px;
	}
</style>

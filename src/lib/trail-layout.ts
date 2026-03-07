/**
 * Trail Layout Abstraction
 *
 * Trail layouts are decoupled from animation logic via SpotPositionFn.
 * Each layout provides its own function mapping spot index -> pixel coordinates.
 *
 * To add a new layout style (vertical mountain, side-scroller, etc.):
 *   1. Create a new function matching SpotPositionFn
 *   2. Pass it to animation components
 *
 * The animation code never knows or cares about the layout shape.
 */

/** Maps a spot index to pixel coordinates. */
export type SpotPositionFn = (spotIndex: number) => { x: number; y: number };

/**
 * Creates a SpotPositionFn for a snaking grid layout where even rows go
 * left-to-right and odd rows go right-to-left.
 */
export function createSnakingGridPositionFn(
	spotsPerRow: number,
	spotSize: number,
	gap: number,
): SpotPositionFn {
	return (spotIndex: number) => {
		const row = Math.floor(spotIndex / spotsPerRow);
		const col = spotIndex % spotsPerRow;
		const effectiveCol = row % 2 === 0 ? col : spotsPerRow - 1 - col;
		return {
			x: effectiveCol * (spotSize + gap),
			y: row * (spotSize + gap),
		};
	};
}

/**
 * Returns an array of percentages [0, ..., 100] with ease-in distribution
 * (t^2 curve). Early hops take more time, later hops are quick.
 *
 * For hopCount=0 or 1, returns [0, 100].
 */
export function generateHopKeyframePercentages(hopCount: number): number[] {
	if (hopCount <= 1) return [0, 100];

	const percentages: number[] = [0];
	for (let i = 1; i <= hopCount; i++) {
		const t = i / hopCount;
		percentages.push(Math.round(t * t * 100));
	}
	return percentages;
}

/**
 * Returns animation duration in milliseconds: 300 + sqrt(hopCount) * 200.
 * Returns 0 for hopCount <= 0.
 */
export function hopAnimationDurationMs(hopCount: number): number {
	if (hopCount <= 0) return 0;
	return 300 + Math.round(Math.sqrt(hopCount) * 200);
}

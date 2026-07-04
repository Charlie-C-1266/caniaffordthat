/** Total number of scrollytelling steps (0: intro ... 1: mode select ... 5: result). */
export const STEP_COUNT = 6

// The design prototype's rail labels (['Start', 'Item', 'Budget', 'Timeframe',
// 'Result']) covered 5 steps with no intro screen. With the intro added as its
// own step 0, "Start" now fits that screen better, so "Mode" was inserted for
// what used to be step 0 (mode-select).
export const STEP_LABELS = ['Start', 'Mode', 'Item', 'Budget', 'Timeframe', 'Result']

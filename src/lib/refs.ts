/** A React ref callback for a plain `<div>` — shared across StepPanel and every step component that registers itself with useStepObserver. */
export type DivRefCallback = (el: HTMLDivElement | null) => void

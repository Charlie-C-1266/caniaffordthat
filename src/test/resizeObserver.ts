// jsdom implements no ResizeObserver at all, and the docs' scroll containers
// use one to tell whether they currently overflow (src/hooks/useOverflowX.ts).
// Without a stub, every test that renders a DataTable or a Formula throws
// "ResizeObserver is not defined" — so this is installed by the three docs
// test files, the same way useStepObserver.test.tsx stubs
// IntersectionObserver for itself.
//
// Kept out of the bundle and of coverage (vite.config.ts excludes src/test/**).

/** A ResizeObserver that never fires on its own; a test fires it with `resizeObserved()`. */
class FakeResizeObserver implements ResizeObserver {
  static instances: FakeResizeObserver[] = []

  private readonly callback: ResizeObserverCallback
  private targets: Element[] = []

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    FakeResizeObserver.instances.push(this)
  }

  observe(target: Element) {
    this.targets.push(target)
  }

  unobserve(target: Element) {
    this.targets = this.targets.filter((observed) => observed !== target)
  }

  disconnect() {
    this.targets = []
  }

  /** Reports every observed element as resized, as a viewport change or a web font loading would. */
  fire() {
    this.callback(
      this.targets.map((target) => ({ target }) as ResizeObserverEntry),
      this,
    )
  }
}

/**
 * Puts the stub on `globalThis` and forgets any observers from an earlier
 * test. Call it in a `beforeEach`, so each test starts with an empty list.
 */
export function installResizeObserver() {
  FakeResizeObserver.instances = []
  globalThis.ResizeObserver = FakeResizeObserver
}

/** Fires every observer created since the last `installResizeObserver()`, so a re-measure happens. */
export function resizeObserved() {
  for (const observer of FakeResizeObserver.instances) observer.fire()
}

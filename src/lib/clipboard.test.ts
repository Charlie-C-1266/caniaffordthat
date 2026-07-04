// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { copyToClipboard } from './clipboard'

const originalClipboard = navigator.clipboard

function stubClipboard(value: Partial<Clipboard> | undefined) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true, writable: true })
}

// jsdom doesn't implement `execCommand` at all, so `vi.spyOn` (which requires
// the property to already exist) fails — define it fresh instead.
function stubExecCommand(returnValue: boolean) {
  const fn = vi.fn().mockReturnValue(returnValue)
  Object.defineProperty(document, 'execCommand', { value: fn, configurable: true, writable: true })
  return fn
}

afterEach(() => {
  stubClipboard(originalClipboard)
  vi.restoreAllMocks()
})

describe('copyToClipboard', () => {
  it('uses the async Clipboard API when available and succeeds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard({ writeText })

    const result = await copyToClipboard('hello')

    expect(result).toBe(true)
    expect(writeText).toHaveBeenCalledExactlyOnceWith('hello')
  })

  it('falls back to execCommand when the Clipboard API is unavailable', async () => {
    stubClipboard(undefined)
    const execCommand = stubExecCommand(true)

    const result = await copyToClipboard('hello')

    expect(result).toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
  })

  it('falls back to execCommand when the Clipboard API rejects', async () => {
    stubClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) })
    stubExecCommand(true)

    const result = await copyToClipboard('hello')

    expect(result).toBe(true)
  })

  it('returns false rather than a false positive when both paths fail', async () => {
    stubClipboard(undefined)
    stubExecCommand(false)

    const result = await copyToClipboard('hello')

    expect(result).toBe(false)
  })

  it('cleans up the temporary textarea it creates for the fallback', async () => {
    stubClipboard(undefined)
    stubExecCommand(true)

    await copyToClipboard('hello')

    expect(document.querySelectorAll('textarea')).toHaveLength(0)
  })
})

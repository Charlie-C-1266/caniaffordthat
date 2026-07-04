/**
 * Copies text to the clipboard, falling back to the legacy `execCommand`
 * technique when the async Clipboard API isn't available (older browsers,
 * or non-HTTPS/non-localhost contexts where it's disabled) or throws (e.g.
 * permission denied). Returns whether the copy actually succeeded, so
 * callers don't show a false "copied" confirmation.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to the legacy technique below.
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  let succeeded = false
  try {
    succeeded = document.execCommand('copy')
  } catch {
    succeeded = false
  }
  document.body.removeChild(textarea)
  return succeeded
}

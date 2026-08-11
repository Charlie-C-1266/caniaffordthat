import { describe, it, expect } from 'vitest'
import { validateProductUrl, isPrivateAddress } from './validateUrl'
import { ParseError } from './types'

describe('validateProductUrl', () => {
  it('accepts a normal https retailer URL', () => {
    const url = validateProductUrl('https://www.currys.co.uk/products/some-item-123.html')
    expect(url.hostname).toBe('www.currys.co.uk')
  })

  it('trims surrounding whitespace', () => {
    expect(validateProductUrl('  https://example.com/x  ').href).toBe('https://example.com/x')
  })

  it.each([
    ['http (not https)', 'http://www.currys.co.uk/x'],
    ['ftp scheme', 'ftp://example.com/x'],
    ['not a URL at all', 'just some text'],
    ['localhost', 'https://localhost/admin'],
    ['a .localhost host', 'https://api.localhost/x'],
    ['a private IPv4 literal', 'https://127.0.0.1/x'],
    ['a link-local metadata IP', 'https://169.254.169.254/latest/meta-data/'],
    ['a private 10.x literal', 'https://10.0.0.5/x'],
  ])('rejects %s', (_label, input) => {
    expect(() => validateProductUrl(input)).toThrow(ParseError)
  })
})

describe('isPrivateAddress', () => {
  it.each(['10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.1', '127.0.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0'])(
    'flags private/reserved IPv4 %s',
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  )

  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '93.184.216.34'])('allows public IPv4 %s', (ip) =>
    expect(isPrivateAddress(ip)).toBe(false),
  )

  it.each(['::1', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:10.0.0.1'])('flags private IPv6 %s', (ip) =>
    expect(isPrivateAddress(ip)).toBe(true),
  )

  it('allows a public IPv6 address', () => {
    expect(isPrivateAddress('2606:4700:4700::1111')).toBe(false)
  })
})

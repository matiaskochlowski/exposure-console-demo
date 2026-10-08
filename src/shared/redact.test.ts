import { describe, expect, it } from 'vitest';
import { redact } from './redact.js';

describe('redact', () => {
  it('replaces hosts, IPs and emails with stable tokens', () => {
    const { text, counts } = redact(
      'httpd on web-001.production.example.com (10.1.2.3) owner team-web@example.com; again 10.1.2.3',
    );
    expect(text).toBe('httpd on [HOST_1] ([IP_1]) owner [EMAIL_1]; again [IP_1]');
    expect(counts).toEqual({ EMAIL: 1, IP: 1, HOST: 1 });
  });

  it('leaves version numbers and ids alone', () => {
    expect(redact('log4j-core 2.14.1 DEMO-2026-00042 CWE-502').text).toBe(
      'log4j-core 2.14.1 DEMO-2026-00042 CWE-502',
    );
  });

  it('does not leak the domain part of an email as a host', () => {
    expect(redact('mail ops@corp.example.com').text).toBe('mail [EMAIL_1]');
  });
});

describe('redact (broader coverage)', () => {
  it.each([
    ['api.staging.acme.dev', '[HOST_1]'],
    ['db.prod.example.co.uk', '[HOST_1]'],
    ['vpn.corp.example.de.', '[HOST_1]'],
    ['fe80::1ff:fe23:4567:890a', '[IP_1]'],
    ['::ffff:10.0.0.1', '[IP_1]'],
  ])('%s → %s', (input, expected) => {
    expect(redact(input).text).toBe(expected);
  });

  it('keeps product names that look like domains', () => {
    expect(redact('Remote code execution in Node.js 8.2.9').text).toBe(
      'Remote code execution in Node.js 8.2.9',
    );
  });
});

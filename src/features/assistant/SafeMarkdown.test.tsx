import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SafeMarkdown } from './SafeMarkdown.js';
import { safeUrl } from './safeUrl.js';

describe('safeUrl', () => {
  it.each([
    ['https://example.com/advisory', 'https://example.com/advisory'],
    ['javascript:alert(1)', ''],
    ['JaVaScRiPt:alert(1)', ''],
    ['data:text/html;base64,PHNjcmlwdD4=', ''],
    ['http://example.com', ''],
    ['//evil.example.com', ''],
    ['/relative', ''],
    ['vbscript:msgbox', ''],
  ])('%s → %s', (input, expected) => {
    expect(safeUrl(input)).toBe(expected);
  });
});

describe('SafeMarkdown', () => {
  it('renders basic formatting', () => {
    render(<SafeMarkdown>{'**P1** because:\n\n- KEV'}</SafeMarkdown>);
    expect(screen.getByText('P1').tagName).toBe('STRONG');
    expect(screen.getByRole('listitem')).toHaveTextContent('KEV');
  });

  it('drops raw HTML instead of rendering it', () => {
    const { container } = render(
      <SafeMarkdown>
        {'Hi <img src=x onerror=alert(1)> <script>alert(1)</script><b>bold</b>'}
      </SafeMarkdown>,
    );
    expect(container.querySelector('img, script, b')).toBeNull();
    expect(container.innerHTML).not.toMatch(/onerror|<script/);
  });

  it('neutralises javascript: and data: links but keeps https links', () => {
    const { container } = render(
      <SafeMarkdown>
        {'[a](javascript:alert(1)) [b](data:text/html,x) [c](https://example.com)'}
      </SafeMarkdown>,
    );
    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', 'https://example.com/');
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer nofollow');
    expect(screen.getByText('a').tagName).toBe('SPAN');
  });

  it('does not render markdown images', () => {
    const { container } = render(
      <SafeMarkdown>{'![pixel](https://tracker.example.com/p.gif?d=secret)'}</SafeMarkdown>,
    );
    expect(container.querySelector('img')).toBeNull();
  });

  it('survives malformed markdown', () => {
    expect(() =>
      render(<SafeMarkdown>{'**unclosed [link](https://x.com *a _b `c\n\n> > >'}</SafeMarkdown>),
    ).not.toThrow();
  });
});

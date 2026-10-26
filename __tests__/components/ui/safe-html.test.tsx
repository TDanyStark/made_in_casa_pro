import { render } from '@testing-library/react';
import { SafeHtml, sanitizeHtml } from '@/components/ui/safe-html';

describe('SafeHtml', () => {
  it('strips img onerror payloads and script tags', () => {
    const { container } = render(
      <SafeHtml html={'<p>hola</p><img src=x onerror="alert(1)"><script>alert(2)</script>'} />
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.innerHTML).not.toMatch(/onerror|alert/);
    expect(container.querySelector('p')).toHaveTextContent('hola');
  });

  it('keeps tiptap formatting', () => {
    const html =
      '<h2>T</h2><p><strong>b</strong><em>i</em><u>u</u><s>s</s><code>c</code></p>' +
      '<ul><li>a</li></ul><ol><li>b</li></ol><blockquote>q</blockquote><pre>p</pre><br><hr>';
    const out = sanitizeHtml(html);
    for (const tag of ['h2', 'strong', 'em', 'u', 's', 'code', 'ul', 'ol', 'li', 'blockquote', 'pre', 'br', 'hr']) {
      expect(out).toContain(`<${tag}>`);
    }
  });

  it('allows http/https/mailto links with rel noopener and drops javascript: hrefs', () => {
    const { container } = render(
      <SafeHtml
        html={'<a href="https://x.com">a</a><a href="mailto:a@b.co">m</a><a href="javascript:alert(1)">j</a>'}
      />
    );
    const links = container.querySelectorAll('a');
    expect(links[0]).toHaveAttribute('href', 'https://x.com');
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer');
    expect(links[1]).toHaveAttribute('href', 'mailto:a@b.co');
    expect(links[2]).not.toHaveAttribute('href');
  });

  it('drops inline event handlers and style on allowed tags', () => {
    expect(sanitizeHtml('<p onclick="x()" style="color:red">t</p>')).toBe('<p>t</p>');
  });

  it('passes className to the wrapper', () => {
    const { container } = render(<SafeHtml html="<p>x</p>" className="prose" />);
    expect(container.firstChild).toHaveClass('prose');
  });
});

import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import Footer from './Footer';
import Navbar from './Navbar';

describe('public navigation', () => {
  it('shows a subtle admin login link without exposing the driver application', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <Navbar />
        <Footer />
      </MemoryRouter>
    );

    expect(markup).toContain('Admin Login');
    expect(markup).toContain('href="/admin/login"');
    expect(markup).not.toContain('href="/apply"');
    expect(markup).not.toMatch(/driver application|rental checkout|admin dashboard/i);
  });
});

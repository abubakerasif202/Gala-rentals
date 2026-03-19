import { describe, expect, it } from 'vitest';

import { buildContentSecurityPolicyDirectives } from '../securityPolicy.js';

describe('buildContentSecurityPolicyDirectives', () => {
  it('allows Google Fonts styles for the public frontend typography', () => {
    const directives = buildContentSecurityPolicyDirectives({
      cspReportingEnabled: false,
    });

    expect(directives.styleSrc).toContain('https://fonts.googleapis.com');
    expect(directives.fontSrc).toContain('https:');
  });

  it('includes the configured Supabase origin in connectSrc', () => {
    const directives = buildContentSecurityPolicyDirectives({
      cspReportingEnabled: false,
      supabaseUrl: 'https://project-ref.supabase.co',
    });

    expect(directives.connectSrc).toContain('https://project-ref.supabase.co');
  });
});

// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { parse } from 'vue/compiler-sfc';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Vitest's bundler pipeline does not have @vitejs/plugin-vue configured, so
// the landing page cannot be imported as a .vue module. The test reads the
// SFC from disk and parses it with vue/compiler-sfc (already shipped with
// vue), then mounts a component that reuses the real template. The Nuxt
// auto-imports (AppHeader, NuxtLink) are replaced by lightweight stubs so
// the assertions only cover the landing copy and the btn-select-room link.
// The happy-dom environment is requested per-file so the mount has a real
// document/Element to render into without changing the global vitest config.

const here = dirname(fileURLToPath(import.meta.url));
const landingPath = resolve(here, '../../../pages/index.vue');
const landingSource = readFileSync(landingPath, 'utf-8');
const { descriptor, errors: parseErrors } = parse(landingSource);
if (parseErrors.length) {
  throw new Error(
    `Failed to parse ${landingPath}: ${parseErrors.map((e) => e.message).join(', ')}`
  );
}
const landingTemplate = descriptor.template?.content;
if (!landingTemplate) {
  throw new Error(`No <template> block found in ${landingPath}`);
}

const AppHeaderStub = { name: 'AppHeader', template: '<i />' };
const NuxtLinkStub = {
  name: 'NuxtLink',
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
};

const LandingPage = defineComponent({
  name: 'LandingPage',
  components: { AppHeader: AppHeaderStub, NuxtLink: NuxtLinkStub },
  template: landingTemplate,
});

const mountLanding = () =>
  mount(LandingPage, {
    global: {
      stubs: {
        AppHeader: AppHeaderStub,
        NuxtLink: NuxtLinkStub,
      },
    },
  });

describe('landing page (pages/index.vue)', () => {
  it('renders the demo landing copy', () => {
    const wrapper = mountLanding();
    expect(wrapper.text()).toContain(
      'This is a demo app for Telnyx Video SDK'
    );
  });

  it('links the btn-select-room control to /rooms', () => {
    const wrapper = mountLanding();
    const link = wrapper.find('[data-testid="btn-select-room"]');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe('/rooms');
    expect(link.text()).toBe('Join A Room');
  });

  it('does not render its own AppHeader', () => {
    const wrapper = mountLanding();
    expect(wrapper.findComponent({ name: 'AppHeader' }).exists()).toBe(false);
  });
});

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import Index from '../../../pages/index.vue';

// The landing page is mounted standalone: the auto-imported Nuxt context
// components (AppHeader via i route component registration, NuxtLink) are
// replaced by lightweight stubs so the test only asserts on the landing
// copy and the btn-select-room link behavior.
const AppHeaderStub = { name: 'AppHeader', template: '<i />' };
const NuxtLinkStub = {
  name: 'NuxtLink',
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
};

const mountLanding = () =>
  mount(Index, {
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
});
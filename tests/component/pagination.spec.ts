// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { loadSfc } from '../helpers/load-sfc';

const Pagination = loadSfc('../../components/Pagination.vue', import.meta.url);

const items = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
}));

const slot = {
  default: `
    <template #default="{ items }">
      <span
        v-for="item in items"
        :key="item.id"
        class="pagination-item"
      >{{ item.id }}</span>
    </template>
  `,
};

const visibleItems = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('.pagination-item').map((item) => item.text());

const mountPagination = (data = items, dataLimit = 5) =>
  mount(Pagination, {
    props: { data, dataLimit },
    slots: slot,
  });

describe('Pagination component (components/Pagination.vue)', () => {
  it('renders accessible previous and next buttons with page status', () => {
    const wrapper = mountPagination();

    const nav = wrapper.get('nav[aria-label="Pagination"]');
    expect(nav.attributes('aria-label')).toBe('Pagination');

    const previous = wrapper.get('button[aria-label="Previous page"]');
    const next = wrapper.get('button[aria-label="Next page"]');
    expect(previous.attributes('type')).toBe('button');
    expect(next.attributes('type')).toBe('button');
    expect(previous.attributes('disabled')).toBeDefined();
    expect(next.attributes('disabled')).toBeUndefined();
    expect(wrapper.get('[data-testid="pagination-status"]').text()).toBe(
      'Page 1 of 3'
    );

    wrapper.unmount();
  });

  it('pages forward and backward through the data', async () => {
    const wrapper = mountPagination();
    expect(visibleItems(wrapper)).toEqual(['1', '2', '3', '4', '5']);

    const next = wrapper.get('button[aria-label="Next page"]');
    await next.trigger('click');

    expect(visibleItems(wrapper)).toEqual(['6', '7', '8', '9', '10']);
    expect(wrapper.get('[data-testid="pagination-status"]').text()).toBe(
      'Page 2 of 3'
    );

    await wrapper.get('button[aria-label="Next page"]').trigger('click');

    expect(visibleItems(wrapper)).toEqual(['11', '12']);
    expect(wrapper.get('[data-testid="pagination-status"]').text()).toBe(
      'Page 3 of 3'
    );
    expect(
      wrapper.get('button[aria-label="Next page"]').attributes('disabled')
    ).toBeDefined();

    await wrapper.get('button[aria-label="Previous page"]').trigger('click');

    expect(visibleItems(wrapper)).toEqual(['6', '7', '8', '9', '10']);

    wrapper.unmount();
  });

  it('uses native buttons for keyboard activation', () => {
    const wrapper = mountPagination();

    expect(wrapper.get('button[aria-label="Previous page"]').element.tagName)
      .toBe('BUTTON');
    expect(wrapper.get('button[aria-label="Next page"]').element.tagName)
      .toBe('BUTTON');

    wrapper.unmount();
  });

  it('hides pagination when there is only one page', () => {
    const wrapper = mountPagination(items.slice(0, 3), 5);

    expect(wrapper.find('nav[aria-label="Pagination"]').exists()).toBe(false);
    expect(visibleItems(wrapper)).toEqual(['1', '2', '3']);

    wrapper.unmount();
  });

  it('clamps the current page when the data shrinks', async () => {
    const wrapper = mountPagination();

    await wrapper.get('button[aria-label="Next page"]').trigger('click');
    await wrapper.get('button[aria-label="Next page"]').trigger('click');
    expect(wrapper.get('[data-testid="pagination-status"]').text()).toBe(
      'Page 3 of 3'
    );

    await wrapper.setProps({ data: items.slice(0, 7) });

    expect(wrapper.get('[data-testid="pagination-status"]').text()).toBe(
      'Page 2 of 2'
    );
    expect(visibleItems(wrapper)).toEqual(['6', '7']);

    await wrapper.setProps({ data: items.slice(0, 2) });

    expect(wrapper.find('nav[aria-label="Pagination"]').exists()).toBe(false);
    expect(visibleItems(wrapper)).toEqual(['1', '2']);

    wrapper.unmount();
  });

  it('exposes the screen-sharing view type on the container', () => {
    const wrapper = mount(Pagination, {
      props: {
        data: items,
        dataLimit: 5,
        viewType: 'screen-sharing',
      },
      slots: slot,
    });

    expect(
      wrapper.get('nav[aria-label="Pagination"]').classes()
    ).toContain('pagination__nav--screen-sharing');

    wrapper.unmount();
  });
});

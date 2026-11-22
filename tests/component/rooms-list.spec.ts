// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadSfc } from '../helpers/load-sfc';

const RoomsList = loadSfc('../../pages/rooms/list.vue', import.meta.url);

const rooms = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    unique_name: 'daily-room',
    max_participants: 12,
    record_audio: true,
    record_video: false,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    unique_name: 'standup',
    max_participants: 4,
    record_audio: false,
    record_video: true,
  },
];

const response = (body: unknown, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  }) as unknown as Response;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('rooms list page (pages/rooms/list.vue)', () => {
  it('shows the loading state until the rooms request resolves', async () => {
    let resolveFetch: (value: Response) => void = () => undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(RoomsList);

    expect(fetchMock).toHaveBeenCalledWith('/api/rooms');
    expect(wrapper.get('[data-testid="rooms-loading"]').text()).toContain(
      'Loading rooms'
    );
    expect(wrapper.find('[data-testid="rooms-table"]').exists()).toBe(false);

    resolveFetch(response(rooms));
    await flushPromises();

    expect(wrapper.find('[data-testid="rooms-loading"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="rooms-table"]').exists()).toBe(true);

    wrapper.unmount();
  });

  it('renders the populated room table with selectable room links', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(rooms)));

    const wrapper = mount(RoomsList);
    await flushPromises();

    const rows = wrapper.findAll('[data-testid="room-row"]');
    expect(rows).toHaveLength(2);
    expect(wrapper.text()).toContain('daily-room');
    expect(wrapper.text()).toContain('standup');
    expect(wrapper.text()).toContain('Max participants');
    expect(wrapper.text()).toContain('Record audio');
    expect(wrapper.text()).toContain('Record video');
    expect(rows[0].text()).toContain(rooms[0].id);
    expect(rows[0].text()).toContain('12');
    expect(rows[0].text()).toContain('Yes');
    expect(rows[0].text()).toContain('No');

    const roomLinks = wrapper.findAll('[data-testid="btn-select-room"]');
    expect(roomLinks).toHaveLength(2);
    expect(roomLinks[0].attributes('href')).toBe(`/rooms/${rooms[0].id}`);
    expect(roomLinks[1].attributes('href')).toBe(`/rooms/${rooms[1].id}`);

    wrapper.unmount();
  });

  it('shows the empty state when the API returns no rooms', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([])));

    const wrapper = mount(RoomsList);
    await flushPromises();

    const empty = wrapper.get('[data-testid="rooms-empty"]');
    expect(empty.text()).toContain('No rooms found. Are you on the VPN?');
    expect(wrapper.find('[data-testid="rooms-table"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it('shows the failure state for an unsuccessful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ message: 'nope' }, false, 500))
    );

    const wrapper = mount(RoomsList);
    await flushPromises();

    const error = wrapper.get('[data-testid="rooms-error"]');
    expect(error.text()).toContain('Unable to load rooms');
    expect(wrapper.find('[data-testid="rooms-table"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it('shows the failure state when the request rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network unavailable'))
    );

    const wrapper = mount(RoomsList);
    await flushPromises();

    expect(wrapper.find('[data-testid="rooms-error"]').exists()).toBe(true);

    wrapper.unmount();
  });

  it('does not render a duplicate application header', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(rooms)));

    const wrapper = mount(RoomsList);
    await flushPromises();

    expect(wrapper.find('header').exists()).toBe(false);
    expect(wrapper.findComponent({ name: 'AppHeader' }).exists()).toBe(false);

    wrapper.unmount();
  });
});

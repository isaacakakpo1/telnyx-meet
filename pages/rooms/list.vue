<template>
  <main class="rooms">
    <div class="rooms__body">
      <h1 class="rooms__title">Rooms</h1>

      <p
        v-if="isLoading"
        class="rooms__status"
        data-testid="rooms-loading"
        role="status"
        aria-live="polite"
      >
        Loading rooms...
      </p>

      <div
        v-else-if="hasError"
        class="rooms__notice rooms__notice--error"
        data-testid="rooms-error"
        role="alert"
      >
        <p class="rooms__notice-text">Unable to load rooms. Please try again.</p>
        <button type="button" class="rooms__retry" @click="loadRooms">
          Retry
        </button>
      </div>

      <div
        v-else-if="rooms.length === 0"
        class="rooms__notice rooms__notice--empty"
        data-testid="rooms-empty"
        role="status"
      >
        <p class="rooms__notice-text">
          No rooms found. Are you on the VPN?
        </p>
      </div>

      <table v-else class="rooms__table" data-testid="rooms-table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">UUID</th>
            <th scope="col">Max participants</th>
            <th scope="col">Record audio</th>
            <th scope="col">Record video</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="room in rooms"
            :key="room.id"
            class="rooms__row"
            data-testid="room-row"
          >
            <td data-label="Name">
              <span class="rooms__room-name">{{ room.unique_name }}</span>
            </td>
            <td data-label="UUID">
              <a
                class="rooms__room-link"
                data-testid="btn-select-room"
                :href="`/rooms/${room.id}`"
              >
                {{ room.id }}
              </a>
            </td>
            <td data-label="Max participants">{{ room.max_participants }}</td>
            <td data-label="Record audio">
              {{ room.record_audio ? 'Yes' : 'No' }}
            </td>
            <td data-label="Record video">
              {{ room.record_video ? 'Yes' : 'No' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

type Room = {
  id: string;
  unique_name: string;
  max_participants: number;
  record_audio: boolean;
  record_video: boolean;
};

defineOptions({ name: 'RoomsList' });

const rooms = ref<Room[]>([]);
const isLoading = ref(true);
const hasError = ref(false);

const loadRooms = async () => {
  isLoading.value = true;
  hasError.value = false;

  try {
    const response = await fetch('/api/rooms');

    if (!response.ok) {
      throw new Error(`Room list request failed with ${response.status}`);
    }

    const data: unknown = await response.json();

    rooms.value = Array.isArray(data) ? (data as Room[]) : [];
  } catch {
    rooms.value = [];
    hasError.value = true;
  } finally {
    isLoading.value = false;
  }
};

onMounted(loadRooms);
</script>

<style scoped>
.rooms {
  min-height: calc(100vh - 3rem);
  background: #f7f7f7;
}

.rooms__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
}

.rooms__title {
  margin: 0;
  font-size: 1.5rem;
}

.rooms__status {
  margin: 0;
  padding: 0.75rem 1rem;
  border-radius: 0.25rem;
  background: rgba(125, 76, 219, 0.08);
  color: #4d2c91;
}

.rooms__notice {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  max-width: 30rem;
  padding: 0.75rem 1rem;
  border-radius: 0.25rem;
}

.rooms__notice--empty {
  background: rgba(197, 47, 12, 0.08);
  color: #7e2f08;
}

.rooms__notice--error {
  background: rgba(197, 47, 12, 0.12);
  color: #7e2f08;
}

.rooms__notice-text {
  margin: 0;
}

.rooms__retry {
  padding: 0.35rem 0.75rem;
  border: 1px solid currentColor;
  border-radius: 0.25rem;
  background: white;
  color: inherit;
  cursor: pointer;
}

.rooms__table {
  width: 100%;
  max-width: 60rem;
  border-collapse: collapse;
  background: white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
}

.rooms__table th,
.rooms__table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e4e4e4;
  text-align: left;
}

.rooms__table th {
  background: #f0edf7;
  font-size: 0.875rem;
}

.rooms__room-name {
  font-weight: bold;
}

.rooms__room-link {
  color: #6a3fc4;
  overflow-wrap: anywhere;
}

.rooms__room-link:focus-visible,
.rooms__retry:focus-visible {
  outline: 2px solid #7d4cdb;
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .rooms__body {
    align-items: stretch;
    padding: 1rem;
  }

  .rooms__table,
  .rooms__table tbody,
  .rooms__table tr,
  .rooms__table td {
    display: block;
    width: 100%;
  }

  .rooms__table {
    box-shadow: none;
    background: transparent;
  }

  .rooms__table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .rooms__table tr {
    margin-bottom: 1rem;
    border-radius: 0.25rem;
    background: white;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
  }

  .rooms__table td {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid #e4e4e4;
  }

  .rooms__table td:last-child {
    border-bottom: 0;
  }

  .rooms__table td::before {
    content: attr(data-label);
    font-weight: bold;
  }
}
</style>

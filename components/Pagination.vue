<template>
  <div class="pagination">
    <nav
      v-if="pages > 1"
      class="pagination__nav"
      :class="{ 'pagination__nav--screen-sharing': viewType === 'screen-sharing' }"
      aria-label="Pagination"
    >
      <button
        type="button"
        class="pagination__button"
        aria-label="Previous page"
        :disabled="currentPage === 1"
        @click="goToPreviousPage"
      >
        <span aria-hidden="true">&lsaquo;</span>
      </button>

      <span class="pagination__status" data-testid="pagination-status" aria-live="polite">
        Page {{ currentPage }} of {{ pages }}
      </span>

      <button
        type="button"
        class="pagination__button"
        aria-label="Next page"
        :disabled="currentPage === pages"
        @click="goToNextPage"
      >
        <span aria-hidden="true">&rsaquo;</span>
      </button>
    </nav>

    <component
      :is="renderer"
      v-if="renderer"
      v-bind="layoutProps"
      :data="paginatedData"
      :items="paginatedData"
    />
    <slot
      v-else
      :items="paginatedData"
      :data="paginatedData"
      :current-page="currentPage"
      :pages="pages"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Component } from 'vue';

const props = withDefaults(
  defineProps<{
    data?: unknown[];
    dataLimit?: number;
    viewType?: 'grid' | 'screen-sharing';
    layoutProps?: Record<string, unknown>;
    renderComponent?: Component | ((props: Record<string, unknown>) => unknown);
    RenderComponent?: Component | ((props: Record<string, unknown>) => unknown);
  }>(),
  {
    data: () => [],
    dataLimit: 10,
    viewType: 'grid',
    layoutProps: () => ({}),
    renderComponent: undefined,
    RenderComponent: undefined,
  }
);

defineOptions({ name: 'Pagination' });

const currentPage = ref(1);

const renderer = computed(
  () => props.renderComponent ?? props.RenderComponent
);

const pages = computed(() =>
  Math.max(1, Math.ceil(props.data.length / Math.max(1, props.dataLimit)))
);

const paginatedData = computed(() => {
  const startIndex = currentPage.value * props.dataLimit - props.dataLimit;
  const endIndex = startIndex + props.dataLimit;

  return props.data.slice(startIndex, endIndex);
});

watch(pages, (pageCount) => {
  if (currentPage.value > pageCount) {
    currentPage.value = pageCount;
  }

  if (pageCount === 1) {
    currentPage.value = 1;
  }
});

function goToNextPage() {
  if (currentPage.value < pages.value) {
    currentPage.value += 1;
  }
}

function goToPreviousPage() {
  if (currentPage.value > 1) {
    currentPage.value -= 1;
  }
}
</script>

<style scoped>
.pagination {
  width: 100%;
}

.pagination__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-bottom: 20px;
}

.pagination__button {
  width: 2.25rem;
  height: 2.25rem;
  border: 0;
  border-radius: 50%;
  background: #cecece;
  color: #333;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
}

.pagination__button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.pagination__button:focus-visible {
  outline: 2px solid #7d4cdb;
  outline-offset: 2px;
}

.pagination__status {
  font-size: 0.875rem;
}

@media (max-width: 1023px) {
  .pagination__nav {
    margin-bottom: 0;
  }

  .pagination__nav--screen-sharing {
    display: none;
  }
}
</style>

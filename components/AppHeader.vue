<template>
  <header class="app-header">
    <NuxtLink to="/" class="app-header__brand">video meet</NuxtLink>
  </header>
</template>

<script setup lang="ts">
// Ported from the legacy React components/AppHeader. The NuxtLink brand
// anchor preserves the original destination ("/") and bold/large label.
</script>

<style scoped>
.app-header {
  padding: 0.5rem;
  background: white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.app-header__brand {
  color: inherit;
  text-decoration: none;
  font-weight: bold;
  font-size: 1.5rem;
}
</style>
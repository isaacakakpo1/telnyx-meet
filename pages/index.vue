<template>
  <main class="landing">
    <div class="landing__body">
      <p class="landing__notice">This is a demo app for Telnyx Video SDK</p>

      <!-- NOTE room ID is hardcoded in backend right now -->
      <NuxtLink data-testid="btn-select-room" to="/rooms" class="btn-select-room">
        Join A Room
      </NuxtLink>
    </div>
  </main>
</template>

<script setup lang="ts">
// Ported from pages/index. The landing keeps the demo notice and the
// btn-select-room link to /rooms; the Grommet Main/Box/Button markup is
// replaced by plain semantic elements.
</script>

<style scoped>
.landing {
  min-height: 100vh;
  background: #f7f7f7;
}

.landing__body {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 1rem;
  padding: 2rem;
}

.landing__notice {
  margin: 0;
  padding: 0.5rem 0.75rem;
  border-radius: 0.25rem;
  background: rgba(197, 47, 12, 0.08);
  color: #7e2f08;
}

.btn-select-room {
  display: inline-block;
  padding: 0.5rem 1rem;
  border: 1px solid #7d4cdb;
  border-radius: 0.25rem;
  background: #7d4cdb;
  color: white;
  text-decoration: none;
}

.btn-select-room:hover {
  background: #6a3fc4;
}
</style>
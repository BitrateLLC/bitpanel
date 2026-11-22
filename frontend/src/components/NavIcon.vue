<script setup lang="ts">
const props = defineProps<{ name: string }>()

const paths: Record<string, string[]> = {
  dashboard: ['M3 3h8v8H3z', 'M13 3h8v5h-8z', 'M13 10h8v11h-8z', 'M3 13h8v8H3z'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M20 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  ticket: ['M2 9a3 3 0 0 0 0 6v4h20v-4a3 3 0 0 1 0-6V5H2z', 'M13 5v2', 'M13 11v2', 'M13 17v2'],
  receipt: ['M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z', 'M8 8h8', 'M8 12h8', 'M8 16h5'],
  package: ['m7.5 4.27 9 5.15', 'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', 'M3.3 7 12 12l8.7-5', 'M12 22V12'],
  refresh: ['M20 7v5h-5', 'M4 17v-5h5', 'M5.6 9A7 7 0 0 1 18 6l2 6', 'M18.4 15A7 7 0 0 1 6 18l-2-6'],
  ticketPercent: ['M2 9a3 3 0 0 0 0 6v4h20v-4a3 3 0 0 1 0-6V5H2z', 'm9 15 6-6', 'M9 9h.01', 'M15 15h.01'],
  gift: ['M20 12v10H4V12', 'M2 7h20v5H2z', 'M12 22V7', 'M12 7H7.5a2.5 2.5 0 1 1 2.5-2.5C10 6 12 7 12 7z', 'M12 7h4.5A2.5 2.5 0 1 0 14 4.5C14 6 12 7 12 7z'],
  network: ['M16 3h5v5h-5z', 'M3 16h5v5H3z', 'M16 16h5v5h-5z', 'M8 18.5h4a4 4 0 0 0 4-4v-7', 'M8 5.5h4a4 4 0 0 1 4 4'],
  server: ['M4 4h16v6H4z', 'M4 14h16v6H4z', 'M8 7h.01', 'M8 17h.01', 'M12 7h5', 'M12 17h5'],
  settings: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.8 3.12-.09-.03a1.7 1.7 0 0 0-1.8.47l-.06.07h-3.6l-.03-.1a1.7 1.7 0 0 0-1.3-1.2l-.1-.02-1.8-3.12.07-.07a1.7 1.7 0 0 0 .32-1.88l-.04-.1V11l.1-.03a1.7 1.7 0 0 0 1.2-1.3l.02-.1 3.12-1.8.07.07a1.7 1.7 0 0 0 1.88.32l.1-.04h3.6l.03.1a1.7 1.7 0 0 0 1.3 1.2l.1.02 1.8 3.12-.07.07A1.7 1.7 0 0 0 20 14.5z'],
  puzzle: ['M19 13h-2a2 2 0 1 1-4 0V5h-3a2 2 0 1 1-4 0H4v5a2 2 0 1 0 0 4v5h5a2 2 0 1 1 4 0h6z'],
  contrast: ['M12 3a9 9 0 1 0 0 18z', 'M12 3v18'],
  bell: ['M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9', 'M10 21h4'],
  card: ['M2 7h20v14H2z', 'M2 11h20', 'M6 16h4'],
  book: ['M12 7v14', 'M3 18V5a2 2 0 0 1 2-2h3a4 4 0 0 1 4 4 4 4 0 0 1 4-4h3a2 2 0 0 1 2 2v13h-5a4 4 0 0 0-4 3 4 4 0 0 0-4-3z'],
  blocks: ['M3 3h8v8H3z', 'M13 3h8v5h-8z', 'M13 10h8v11h-8z', 'M3 13h8v8H3z'],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  file: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M8 13h8', 'M8 17h8'],
  alert: ['M10.3 3.9 1.8 18.1A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0z', 'M12 9v4', 'M12 17h.01'],
  mail: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'm22 6-10 7L2 6'],
  chart: ['M3 3v18h18', 'M18 17V9', 'M13 17V5', 'M8 17v-3'],
  circle: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z'],
}
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path v-for="(path, index) in paths[name] ?? paths.circle" :key="index" :d="path" />
  </svg>
</template>

<template>
  <map-group></map-group>
</template>

<script lang="ts">
  // @ is an alias to /src
  import MapGroup from '@/components/Map/MapGroup.vue';

  export default {
    name: 'Home',
    components: {
      MapGroup,
    },
  };
</script>

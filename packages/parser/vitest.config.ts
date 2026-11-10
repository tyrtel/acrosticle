import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'parser',
    environment: 'node',
  },
});

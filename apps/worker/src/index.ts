import { route } from './router';

export { PuzzleRoom } from './room/PuzzleRoom';

export default {
  fetch(request, env): Promise<Response> {
    return route(request, env);
  },
} satisfies ExportedHandler<Env>;

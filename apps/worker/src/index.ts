import { route } from './router';

export { PuzzleRoom } from './room/PuzzleRoom';

export default {
  fetch(request, env, ctx): Promise<Response> {
    return route(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;

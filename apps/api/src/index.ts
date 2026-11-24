import { DurableObject } from 'cloudflare:workers';

export class AuthGuard extends DurableObject {}

export default {
  fetch: () => new Response('ok'),
} satisfies ExportedHandler;

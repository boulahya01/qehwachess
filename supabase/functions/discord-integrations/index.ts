import {
  backend,
  client,
  configured,
  cors,
  discord,
  env,
  failure,
  origin,
  response,
} from '../_shared/discord-platform.ts';
import { action, target } from '../_shared/discord-service.ts';
import { IntegrationError } from '../_shared/discord-domain.ts';
Deno.serve(async (request) => {
  let headers: Record<string, string> = {};
  try {
    headers = cors(request);
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers });
    if (request.method !== 'POST')
      throw new IntegrationError('invalid_request', 405);
    const bearer = request.headers
      .get('Authorization')
      ?.match(/^Bearer (.+)$/)?.[1];
    if (!bearer) throw new IntegrationError('signin_required', 401);
    const service = client();
    const { data, error } = await service.auth.getUser(bearer);
    if (error || !data.user) throw new IntegrationError('signin_required', 401);
    const body = await request.json();
    const tenant = target(data.user.id, body.scope, body.club_id);
    const db = backend(service);
    const current = await db('status', tenant);
    if (body.action === 'status')
      return response(
        {
          ...(current as object),
          configured: configured(),
          install_url: configured()
            ? 'https://discord.com/oauth2/authorize?' +
              new URLSearchParams({
                client_id: env('DISCORD_CLIENT_ID'),
                scope: 'bot',
                permissions: '19456',
                integration_type: '0',
              })
            : null,
        },
        200,
        headers
      );
    if (!configured()) throw new IntegrationError('not_configured', 503);
    const callback =
      env('SUPABASE_URL') + '/functions/v1/discord-connect-callback';
    return response(
      await action(
        db,
        discord(),
        origin(),
        env('DISCORD_CLIENT_ID'),
        callback,
        tenant,
        body,
        request.headers.get('Origin') || origin()
      ),
      200,
      headers
    );
  } catch (error) {
    return failure(error, headers);
  }
});

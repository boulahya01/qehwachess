import {
  backend,
  client,
  discord,
  failure,
  origin,
  response,
} from '../_shared/discord-platform.ts';
import { processDelivery } from '../_shared/discord-service.ts';
import { IntegrationError } from '../_shared/discord-domain.ts';
Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST')
      throw new IntegrationError('invalid_request', 405);
    const token = request.headers.get('X-Qehwa-Worker-Secret');
    if (!token || !/^[0-9a-f]{64}$/.test(token))
      throw new IntegrationError('worker_denied', 401);
    const db = backend(client());
    if (!(await db('worker_auth', { token })))
      throw new IntegrationError('worker_denied', 401);
    const bot = discord(),
      appOrigin = origin();
    const jobs = (await db('claim')) as {
      msg_id: number;
      message: { delivery_id: string };
    }[];
    // Small parallel batches finish within the lease and function time limits.
    const result = await Promise.all(
      jobs.map((job) =>
        processDelivery(db, bot, appOrigin, job.message.delivery_id, job.msg_id)
      )
    );
    return response({ processed: result.length });
  } catch (error) {
    return failure(error);
  }
});

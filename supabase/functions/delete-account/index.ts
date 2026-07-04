import { getUser, serviceClient } from '../_shared/db.ts';
import { errorResponse, handleOptions, jsonResponse } from '../_shared/http.ts';

/**
 * GDPR account deletion (App Store requirement too).
 * Every user table references auth.users with ON DELETE CASCADE, so removing
 * the auth user erases all personal data in one atomic operation.
 */
Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  const user = await getUser(req);
  if (!user) return errorResponse('unauthorized');

  const service = serviceClient();
  const { error } = await service.auth.admin.deleteUser(user.id);
  if (error) return errorResponse('provider_error', error.message);

  return jsonResponse({ ok: true });
});

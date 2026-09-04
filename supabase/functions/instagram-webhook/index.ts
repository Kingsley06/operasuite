import { handleMetaMessagingWebhook } from '../_shared/metaMessagingWebhook.ts';

Deno.serve((req) => handleMetaMessagingWebhook(req, 'instagram'));

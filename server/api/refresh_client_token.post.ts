import { defineEventHandler } from 'h3';

import { handleRefreshClientToken } from '../utils/telnyx-upstream';

export default defineEventHandler((event) => handleRefreshClientToken(event));

import { defineEventHandler } from 'h3';

import { handleClientToken } from '../utils/telnyx-upstream';

export default defineEventHandler((event) => handleClientToken(event));

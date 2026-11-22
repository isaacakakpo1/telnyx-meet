import { defineEventHandler } from 'h3';

import { handleDialOut } from '../utils/telnyx-upstream';

export default defineEventHandler((event) => handleDialOut(event));

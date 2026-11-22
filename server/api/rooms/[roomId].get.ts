import { defineEventHandler } from 'h3';

import { handleRoomLookup } from '../../utils/room-upstream';

export default defineEventHandler((event) => handleRoomLookup(event));

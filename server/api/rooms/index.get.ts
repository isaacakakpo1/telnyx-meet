import { defineEventHandler } from 'h3';

import { handleRoomList } from '../../utils/room-upstream';

export default defineEventHandler((event) => handleRoomList(event));

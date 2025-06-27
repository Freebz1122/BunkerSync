```javascript
import Dexie from 'https://unpkg.com/dexie@3.2.2/dist/dexie.min.js';
const db = new Dexie('BunkerSyncDB');
db.version(2).stores({
  courses: 'id, name, maps',
  bunkers: 'id, courseId, holeNumber, lat, lng',
  tasks: 'id, courseId, bunkerId, description, type, status, timestamp',
  maps: 'id, courseId, url'
});
export { db };
```
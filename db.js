import Dexie from 'https://cdn.jsdelivr.net/npm/dexie@3/dist/dexie.min.js';

const db = new Dexie('BunkerSyncDB');
db.version(1).stores({
  tasks: 'id,courseId,description,type,status,timestamp,bunkerId',
  bunkers: 'id,courseId,x,y'
});
export { db };
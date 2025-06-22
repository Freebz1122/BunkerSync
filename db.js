import { Dexie } from 'https://unpkg.com/dexie@3.2.2/dist/dexie.js';

const db = new Dexie('BunkerSyncDB');
db.version(1).stores({
  tasks: '++id,courseId,bunkerId,description,type,status,timestamp',
  bunkers: '++id,courseId,holeNumber,lat,lng',
  courses: 'id,name,maps'
});

export { db };
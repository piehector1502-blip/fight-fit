// Local database stored in the browser (IndexedDB), wrapped by Dexie.
// Data stays on the device and works offline.
//
// Schema syntax: the first field is the primary key, the others are
// indexes (fields we can search/sort on). '++id' = auto-increment key.
// Fields NOT listed are still saved, they just aren't indexed.
//
// Every record gets an `updatedAt` timestamp: later, the Java server
// will use it to sync changes between phone and account.
import Dexie from 'dexie';

export const db = new Dexie('fightfit');

db.version(1).stores({
  profile:  'id',                     // single row, id = 'me'
  presets:  '++id, name',             // round timer presets
  workouts: '++id, date',             // training sessions
  meals:    '++id, date',             // food entries
  foods:    '++id, name, barcode',    // saved products (from Open Food Facts)
  weights:  '++id, &date',            // one weigh-in per day ('&' = unique)
});

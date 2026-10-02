/* 저장 폴더 — 「저장」을 누를 때마다 브라우저의 다운로드 폴더로 떨어지는 대신
   미리 고른 폴더에 곧바로 쓴다.

   폴더 손잡이(DirectoryHandle)는 JSON 으로 바뀌지 않아 localStorage 에 담을
   수 없다. 구조화 복제가 되는 IndexedDB 에만 담기므로 여기만 따로 쓴다.

   크롬·엣지 데스크톱에만 있는 기능이다. 사파리와 폰에서는 고를 수 없고,
   그때는 지금까지처럼 다운로드(폰은 공유 시트)로 간다. */

const DB_NAME = 'textshot-fs';
const STORE = 'handles';
const KEY = 'outDir';

export const supported = () => typeof window.showDirectoryPicker === 'function';

function openDb() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB_NAME, 1);
    rq.onupgradeneeded = () => {
      if (!rq.result.objectStoreNames.contains(STORE)) rq.result.createObjectStore(STORE);
    };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}

async function idb(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((res, rej) => {
      const tx = db.transaction(STORE, mode);
      const rq = fn(tx.objectStore(STORE));
      tx.onerror = () => rej(tx.error);
      if (rq) { rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); }
      else tx.oncomplete = () => res();
    });
  } finally { db.close(); }
}

/* 지금 고른 폴더. 저장할 때마다 IndexedDB 를 다시 뒤지지 않도록 들고 있는다. */
let dir = null;

/* 켤 때 한 번 — 지난번에 고른 폴더가 있으면 되살린다.
   되살려도 권한은 「물어봄」으로 돌아가 있을 수 있다. 그건 저장할 때 묻는다. */
export async function load() {
  if (!supported()) return null;
  try {
    const handle = await idb('readonly', (s) => s.get(KEY));
    if (handle) dir = { handle, name: handle.name };
  } catch (e) { console.warn('저장 폴더를 되살리지 못했습니다', e); }
  return dir;
}

export function current() { return dir; }

export async function pick() {
  const handle = await window.showDirectoryPicker({ id: 'textshot-out', mode: 'readwrite', startIn: 'downloads' });
  dir = { handle, name: handle.name };
  try { await idb('readwrite', (s) => s.put(handle, KEY)); }
  catch (e) { console.warn('저장 폴더를 기억하지 못했습니다', e); }
  return dir;
}

export async function forget() {
  dir = null;
  try { await idb('readwrite', (s) => s.delete(KEY)); } catch (e) { /* 없으면 그만이다 */ }
}

/* 쓸 수 있는 상태인지. 되살린 손잡이는 권한을 다시 받아야 하는데, 그 창은
   사용자가 누른 직후에만 열린다. 그래서 「저장」을 누른 맨 처음에 부른다. */
export async function ready() {
  if (!dir) return false;
  try {
    const opt = { mode: 'readwrite' };
    if (await dir.handle.queryPermission(opt) === 'granted') return true;
    return await dir.handle.requestPermission(opt) === 'granted';
  } catch (e) {
    console.warn('저장 폴더 권한을 받지 못했습니다', e);
    return false;
  }
}

/* 같은 이름이 이미 있으면 덮어쓰지 않고 뒤에 번호를 붙인다.
   파일 이름에 분까지만 들어가므로 같은 분에 두 번 저장하면 겹친다. */
async function freeName(folder, name) {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let n = 1; n < 100; n++) {
    const cand = n === 1 ? name : `${base}-${n}${ext}`;
    try { await folder.getFileHandle(cand); } catch { return cand; }
  }
  return `${base}-${Date.now()}${ext}`;
}

/* files: [{ name, blob }] — 쓴 이름들을 돌려준다 */
export async function writeFiles(files) {
  if (!dir) throw new Error('저장 폴더가 없습니다');
  const done = [];
  for (const f of files) {
    const name = await freeName(dir.handle, f.name);
    const fh = await dir.handle.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(f.blob);
    await w.close();
    done.push(name);
  }
  return done;
}

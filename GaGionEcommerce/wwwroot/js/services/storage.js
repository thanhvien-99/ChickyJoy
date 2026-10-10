export function loadJSON(key, fallback){
  try { const value=localStorage.getItem(key); return value===null?fallback:JSON.parse(value); }
  catch { return fallback; }
}
export function saveJSON(key,value){
  try { localStorage.setItem(key,JSON.stringify(value)); return true; }
  catch { return false; }
}

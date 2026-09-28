/* Published IDs are the only navigation targets; never interpolate document HTML. */
const $ = id => document.getElementById(id);
let config, pages = [], current = '', version = '', busy = false, loaded = false;
function selected() { try { return decodeURIComponent(location.hash.slice(1)); } catch { return ''; } }
function list() {
  const query = $('search').value.toLocaleLowerCase();
  $('pages').replaceChildren();
  for (const p of pages.filter(p => `${p.title} ${p.tags.join(' ')}`.toLocaleLowerCase().includes(query))) {
    const a = document.createElement('a'); a.href = '#' + encodeURIComponent(p.id); a.textContent = p.title;
    a.className = p.id === selected() ? 'active' : '';
    const small = document.createElement('small'); small.textContent = p.tags.join(' · '); a.append(small); $('pages').append(a);
  }
}
async function get(path) {
  const response = await fetch(config.apiBase + path, {cache:'no-store', signal:AbortSignal.timeout(8000)});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
function render(page) {
  $('content').innerHTML = DOMPurify.sanitize(marked.parse(page.body), {FORBID_TAGS:['img','iframe','style','form','input'], FORBID_ATTR:['style']});
  const walker = document.createTreeWalker($('content'), NodeFilter.SHOW_TEXT);
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (node.parentElement.closest('a,code,pre')) continue;
    const pattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    const fragment = document.createDocumentFragment(); let last = 0, match;
    while ((match = pattern.exec(node.textContent))) {
      fragment.append(node.textContent.slice(last, match.index));
      const target = pages.find(p => p.slug === match[1] || p.id === match[1]);
      if (target) { const a = document.createElement('a'); a.href = '#' + encodeURIComponent(target.id); a.textContent = match[2] || match[1]; fragment.append(a); }
      else fragment.append(match[2] || match[1]);
      last = pattern.lastIndex;
    }
    if (last) { fragment.append(node.textContent.slice(last)); node.replaceWith(fragment); }
  }
  $('meta').textContent = `문서 수정 · ${new Date(page.updated).toLocaleString('ko-KR')}`;
  document.title = `${page.title} · Juicy Wiki`;
}
async function sync() {
  if (busy || !config) return;
  busy = true;
  try {
    pages = (await get('/api/pages')).pages;
    if (!selected() && pages.length) history.replaceState(null, '', '#' + pages[0].id);
    list();
    const id = selected(), meta = pages.find(p => p.id === id);
    if (!meta) {
      $('content').textContent = '공개되지 않았거나 삭제된 문서입니다.'; $('meta').textContent = ''; current = ''; version = '';
    } else if (current !== id || version !== meta.version) {
      const page = await get('/api/pages/' + encodeURIComponent(id));
      if (selected() === id) { render(page); current = id; version = page.version; }
    }
    loaded = true;
    $('status').textContent = `● 연결됨 · 마지막 확인 ${new Date().toLocaleTimeString('ko-KR')}`;
  } catch (error) {
    $('status').textContent = '○ 연결 끊김 · 자동으로 다시 연결합니다';
    if (!loaded) $('content').textContent = '문서 서버에 연결할 수 없습니다. 잠시 후 자동으로 다시 시도합니다.';
  } finally { busy = false; }
}
$('search').addEventListener('input', list);
$('refresh').addEventListener('click', sync);
window.addEventListener('hashchange', sync);
(async () => {
  try {
    const response = await fetch('config.json', {cache:'no-store'}); config = await response.json();
    if (!/^https:\/\//.test(config.apiBase)) throw new Error('Missing HTTPS API');
    await sync(); setInterval(sync, config.pollMs || 5000);
  } catch { $('status').textContent = '연결 설정을 확인해 주세요'; $('content').textContent = '문서 서버 주소가 아직 준비되지 않았습니다.'; }
})();

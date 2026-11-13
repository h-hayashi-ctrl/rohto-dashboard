/* A small stand-in for the parts of the Claude dashboard runtime this page uses
   (dash.data, dash.calc, dash.draw, dash.onData, dash.colors), so the page's own
   code runs unchanged as a static site. Data comes from data/<id>.json beside it. */
(function () {
  const SOURCES = ['account', 'markets', 'sizing', 'skills', 'trades', 'brackets', 'articles', 'hormuz_transits', 'spcx_mcap'];
  const store = {};
  const calcs = {};
  const draws = {};
  const listeners = [];
  const made = new Map();

  const empty = (status, message) => ({ status, data: [], columns: [], message: message || '', refreshing: false, meta: {} });
  const ok = (rows) => ({ status: 'ok', data: rows, columns: Array.isArray(rows) && rows[0] ? Object.keys(rows[0]) : [],
                          message: '', refreshing: false, meta: {} });

  window.dash = {
    colors: ['#3b7dd8', '#e07b39', '#2f9e6b', '#9b5de5', '#d64545'],
    data(id) {
      if (store[id]) return store[id];
      if (calcs[id]) return { status: 'loading', data: null, columns: [], message: '', refreshing: false, meta: {} };
      return SOURCES.includes(id) ? empty('loading') : empty('missing');
    },
    calc(id, spec) { calcs[id] = spec; },
    loader() {},
    draw(name, spec) { draws[name] = typeof spec === 'function' ? { update: spec } : spec; },
    onData(fn) { listeners.push(fn); fn(); },
    refresh() {}, params() { return {}; }, setParams() {}, resetParams() {}, setLink() {}
  };

  function runCalcs() {
    for (const [id, c] of Object.entries(calcs)) {
      const inputs = c.inputs.map((i) => store[i]);
      if (inputs.every((s) => s && s.status === 'ok')) {
        try { store[id] = ok(c.fn(...inputs.map((s) => (Array.isArray(s.data) ? s.data : [])))); }
        catch (e) { store[id] = empty('error', String(e)); console.error('calc', id, e); }
      }
    }
  }

  function render() {
    document.querySelectorAll('[data-draw]').forEach((el) => {
      const d = draws[el.dataset.draw];
      if (!d) return;
      try {
        if (d.mount && !made.has(el)) made.set(el, d.mount(el));
        if (d.update) d.update(el, made.get(el));
      } catch (e) { console.error('draw', el.dataset.draw, e); }
    });
    listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  }

  function load() {
    render(); // placeholders while loading
    Promise.all(SOURCES.map((id) => fetch('data/' + id + '.json', { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then((rows) => { store[id] = ok(rows); })
      .catch((e) => { store[id] = empty('error', String(e)); })))
      .then(() => { runCalcs(); render(); });
  }

  let lastW = 0, timer = null;
  window.addEventListener('resize', () => {
    const w = document.documentElement.clientWidth;
    if (w === lastW) return;
    lastW = w;
    clearTimeout(timer);
    timer = setTimeout(render, 150);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();

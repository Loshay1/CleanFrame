// Deterministic weather tests: no network, browser, location permission or TV.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/weather.js', import.meta.url), 'utf8');
const KEY = 'cleanframe.weather.chicago.v1';
function harness({ cache, brokenStorage = false } = {}) {
  let time = 1793966400000, next = 0;
  const timers = new Map(), requests = [], values = new Map(), changes = [];
  if (cache) values.set(KEY, JSON.stringify(cache(time)));
  const storage = {
    getItem: key => { if (brokenStorage) throw Error('Blocked'); return values.get(key) || null; },
    setItem: (key, value) => { if (brokenStorage) throw Error('Full'); values.set(key, value); }
  };
  const context = { window: {}, setTimeout, clearTimeout };
  vm.runInNewContext(source, context);
  const client = context.window.CleanFrameWeather.create({
    now: () => time, storage,
    setTimer: (fn, ms) => { const id = ++next; timers.set(id, { fn, at: time + ms }); return id; },
    clearTimer: id => timers.delete(id),
    onchange: state => changes.push(state),
    xhrFactory: () => {
      const xhr = { open(method, url, async) { Object.assign(this, { method, url, async }); }, send() {}, abort() { this.aborted = true; this.onerror?.(); } };
      requests.push(xhr); return xhr;
    }
  });
  function tick(ms) {
    const end = time + ms;
    for (;;) {
      const entry = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry || entry[1].at > end) break;
      const [id, timer] = entry; timers.delete(id); time = timer.at; timer.fn();
    }
    time = end;
  }
  function respond({ status = 200, current = {}, units = '°C', raw } = {}, index = requests.length - 1) {
    Object.assign(requests[index], { status, responseText: raw ?? JSON.stringify({
      current_units: { temperature_2m: units },
      current: { temperature_2m: 12, weather_code: 2, is_day: 1, time: time / 1000, ...current }
    }) });
    requests[index].onload();
  }
  return { client, requests, values, changes, timers, tick, respond, now: () => time, condition: context.window.CleanFrameWeather.condition };
}

test('off does not fetch; activation uses fixed Chicago coordinates and an async timeout', () => {
  const h = harness();
  assert.equal(h.client.state().status, 'off'); assert.equal(h.requests.length, 0);
  h.client.setActive(true);
  assert.equal(h.requests.length, 1); assert.equal(h.requests[0].method, 'GET');
  assert.equal(h.requests[0].async, true); assert.equal(h.requests[0].timeout, 8000);
  const url = new URL(h.requests[0].url);
  assert.equal(url.origin, 'https://api.open-meteo.com'); assert.equal(url.searchParams.get('latitude'), '41.8781');
  assert.equal(url.searchParams.get('temperature_unit'), 'celsius');
  h.respond();
  assert.equal(h.client.state().status, 'ready'); assert.equal(h.client.state().temperature, 12);
  assert.equal(h.client.state().condition, 'Partly cloudy'); assert.ok(h.values.has(KEY));
});

test('polls every 15 minutes; repeat activation never duplicates a request', () => {
  const h = harness(); h.client.setActive(true); h.client.setActive(true); h.respond();
  h.tick(899999); assert.equal(h.requests.length, 1);
  h.tick(1); assert.equal(h.requests.length, 2); h.respond();
  h.client.destroy(); assert.equal(h.timers.size, 0);
});

test('fresh cache is used without an immediate network request', () => {
  const h = harness({ cache: now => ({ temperature: -2, code: 71, day: 0, observedAt: now - 60000, fetchedAt: now - 60000 }) });
  h.client.setActive(true);
  assert.equal(h.client.state().temperature, -2); assert.equal(h.client.state().condition, 'Snow');
  assert.equal(h.requests.length, 0); h.tick(14 * 60000); assert.equal(h.requests.length, 1);
});

test('hiding or disabling aborts pending work, clears timers, and ignores late results', () => {
  const h = harness(); h.client.setActive(true); h.client.setActive(false);
  assert.equal(h.requests[0].aborted, true); assert.equal(h.timers.size, 0);
  h.respond(); assert.equal(h.client.state().status, 'off'); assert.equal(h.values.size, 0);
  h.tick(20 * 60000); assert.equal(h.requests.length, 1);
  h.client.setActive(true); assert.equal(h.requests.length, 2); h.respond();
  assert.equal(h.client.state().status, 'ready');
});

test('failed refresh shows cached data as stale, then expires it', () => {
  const h = harness(); h.client.setActive(true); h.respond(); h.tick(15 * 60000);
  h.respond({ status: 503 });
  assert.equal(h.client.state().status, 'stale'); assert.equal(h.client.state().temperature, 12);
  h.tick(6 * 60 * 60000);
  assert.equal(h.client.state().status, 'unavailable'); assert.equal(h.client.state().temperature, null);
});

test('timeout and network errors back off; visibility changes cannot bypass the retry interval', () => {
  const h = harness(); h.client.setActive(true); h.requests[0].ontimeout();
  assert.equal(h.client.state().status, 'unavailable');
  h.client.setActive(false); h.client.setActive(true); assert.equal(h.requests.length, 1);
  h.tick(60000); assert.equal(h.requests.length, 2); h.requests[1].onerror();
  h.tick(119999); assert.equal(h.requests.length, 2); h.tick(1); assert.equal(h.requests.length, 3);
  h.respond(); assert.equal(h.client.state().status, 'ready');
});

test('invalid, future, missing and wrong-unit API data never become displayed weather', () => {
  for (const bad of [{ raw: 'not json' }, { current: { temperature_2m: null } }, { current: { temperature_2m: 300 } },
    { current: { weather_code: '<script>' } }, { current: { is_day: null } }, { current: { time: null } },
    { current: { time: 9999999999 } }, { units: '°F' }]) {
    const h = harness(); h.client.setActive(true); h.respond(bad);
    assert.equal(h.client.state().status, 'unavailable', JSON.stringify(bad)); assert.equal(h.values.size, 0);
  }
});

test('old or corrupt cache is ignored; weather works with unavailable local storage', () => {
  for (const options of [{ brokenStorage: true }, { cache: () => ({ temperature: 99 }) },
    { cache: now => ({ temperature: 10, code: 0, day: 1, observedAt: now - 7 * 3600000, fetchedAt: now }) }]) {
    const h = harness(options); h.client.setActive(true);
    assert.equal(h.client.state().temperature, null); assert.equal(h.requests.length, 1);
    h.respond(); assert.equal(h.client.state().status, 'ready');
  }
});

test('night, fog, frozen rain, snow and storms have accurate labels and local icons', () => {
  const h = harness();
  assert.equal(h.condition(0, 0).icon, 'moon'); assert.equal(h.condition(48, 1).label, 'Fog');
  assert.equal(h.condition(67, 1).icon, 'rain'); assert.equal(h.condition(86, 1).icon, 'snow');
  assert.equal(h.condition(99, 1).label, 'Thunderstorms'); assert.equal(h.condition(100, 1), null);
});

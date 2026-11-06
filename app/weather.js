/* Optional Chicago weather. One small request, cached locally; no location permission or key. */
(function () {
  'use strict';
  var KEY = 'cleanframe.weather.chicago.v1';
  var REFRESH = 15 * 60000, STALE = 30 * 60000, EXPIRE = 6 * 60 * 60000;
  var URL = 'https://api.open-meteo.com/v1/forecast?latitude=41.8781&longitude=-87.6298&current=temperature_2m,weather_code,is_day&temperature_unit=celsius&timeformat=unixtime&timezone=America%2FChicago&forecast_days=1';
  function condition(code, day) {
    if (code === 0) return { label: day ? 'Clear' : 'Clear night', icon: day ? 'sun' : 'moon' };
    if (code === 1 || code === 2) return { label: 'Partly cloudy', icon: 'cloud' };
    if (code === 3) return { label: 'Overcast', icon: 'cloud' };
    if (code === 45 || code === 48) return { label: 'Fog', icon: 'fog' };
    if ([51, 53, 55, 56, 57].indexOf(code) >= 0) return { label: 'Drizzle', icon: 'rain' };
    if ([61, 63, 65, 66, 67, 80, 81, 82].indexOf(code) >= 0) return { label: 'Rain', icon: 'rain' };
    if ([71, 73, 75, 77, 85, 86].indexOf(code) >= 0) return { label: 'Snow', icon: 'snow' };
    if ([95, 96, 99].indexOf(code) >= 0) return { label: 'Thunderstorms', icon: 'storm' };
    return null;
  }
  function number(value) { return typeof value === 'number' && isFinite(value); }
  function valid(data, now) {
    return data && number(data.temperature) && data.temperature >= -100 && data.temperature <= 70
      && (data.day === 0 || data.day === 1) && !!condition(data.code, data.day)
      && number(data.observedAt) && data.observedAt <= now + 5 * 60000 && now - data.observedAt < EXPIRE
      && number(data.fetchedAt) && data.fetchedAt <= now && now - data.fetchedAt < EXPIRE;
  }
  function create(options) {
    var opts = options || {}, now = opts.now || Date.now;
    var later = opts.setTimer || setTimeout, cancel = opts.clearTimer || clearTimeout;
    var storage = opts.storage, makeXHR = opts.xhrFactory || function () { return new window.XMLHttpRequest(); };
    var data = null, active = false, timer = null, request = null, generation = 0, failures = 0, retryAt = 0, failed = false;
    try {
      storage = storage || window.localStorage;
      data = JSON.parse(storage.getItem(KEY));
      if (!valid(data, now())) data = null;
    } catch (e) { data = null; }
    function state() {
      var usable = valid(data, now()), info = usable ? condition(data.code, data.day) : null;
      return { status: !active ? 'off' : usable ? failed || now() - data.observedAt >= STALE ? 'stale' : 'ready' : failed ? 'unavailable' : 'loading',
        temperature: usable ? data.temperature : null, condition: info ? info.label : '', icon: info ? info.icon : 'cloud',
        observedAt: usable ? data.observedAt : null, fetchedAt: usable ? data.fetchedAt : null };
    }
    function emit() { if (opts.onchange) opts.onchange(state()); }
    function stop() {
      generation++;
      if (timer !== null) cancel(timer);
      timer = null;
      if (request) { var old = request; request = null; old.abort(); }
    }
    function schedule(delay) {
      if (timer !== null) cancel(timer);
      timer = active ? later(fetchWeather, Math.max(1, delay)) : null;
    }
    function fetchWeather() {
      var xhr, token, settled = false;
      timer = null;
      if (!active || request) return;
      if (retryAt > now()) { schedule(retryAt - now()); return; }
      token = ++generation;
      function finish(ok) {
        var body, current, candidate;
        if (settled || token !== generation || !active) return;
        settled = true; request = null;
        if (ok) {
          try {
            body = JSON.parse(xhr.responseText); current = body.current;
            candidate = { temperature: current.temperature_2m, code: current.weather_code, day: current.is_day, observedAt: current.time * 1000, fetchedAt: now() };
            if (body.current_units.temperature_2m !== '°C' || !valid(candidate, now())) ok = false;
          } catch (e) { ok = false; }
        }
        failed = !ok;
        if (ok) {
          data = candidate; failures = 0; retryAt = now() + REFRESH;
          try { storage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* Weather remains usable without storage. */ }
        } else { failures++; retryAt = now() + Math.min(REFRESH, 60000 * Math.pow(2, failures - 1)); }
        emit(); schedule(retryAt - now());
      }
      try {
        xhr = makeXHR(); request = xhr;
        xhr.open('GET', URL, true); xhr.timeout = 8000;
        xhr.onload = function () { finish(xhr.status >= 200 && xhr.status < 300); };
        xhr.onerror = xhr.ontimeout = function () { finish(false); };
        xhr.send();
      } catch (e) { finish(false); }
    }
    function setActive(value) {
      value = !!value;
      if (value === active) return;
      active = value;
      if (!active) { stop(); emit(); return; }
      if (valid(data, now()) && !failed) retryAt = Math.max(retryAt, data.fetchedAt + REFRESH);
      emit();
      if (retryAt > now()) schedule(retryAt - now()); else fetchWeather();
    }
    return { setActive: setActive, state: state, destroy: function () { active = false; stop(); } };
  }
  window.CleanFrameWeather = { create: create, condition: condition };
})();

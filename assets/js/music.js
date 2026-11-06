/* =====================================================================
   The official wedding song (assets/audio/wedding-song.mp3)
   played through ONE <audio> element. Same small API as before:
     WeddingMusic.play(fromStart) -> Promise<boolean>   (false if blocked / failed)
     WeddingMusic.pause(), .playing, .state, .onChange(fn), .setVolume(v)
   - starts only from a guest tap (the "open invitation" button or the
     music button) — no autoplay;
   - pause keeps the position, play resumes from it; loops at the end;
   - pauses while the tab is hidden and resumes when the guest returns.
   ===================================================================== */
(function () {
  'use strict';
  var C = window.WEDDING || {};
  var src = (C.music && C.music.src) || 'assets/audio/wedding-song.mp3';
  var audio = document.createElement('audio');
  audio.id = 'weddingSong';
  audio.src = src;
  audio.preload = 'metadata';
  audio.loop = true;
  audio.setAttribute('playsinline', '');
  document.body.appendChild(audio);

  var state = 'idle';               // idle | playing | paused | blocked | error
  var listeners = [];
  var hiddenPaused = false;
  function set(st) { state = st; listeners.forEach(function (fn) { try { fn(st); } catch (e) {} }); }

  audio.addEventListener('playing', function () { set('playing'); });
  audio.addEventListener('pause', function () { if (state === 'playing') set('paused'); });
  audio.addEventListener('error', function () { set('error'); });

  function play(fromStart) {
    if (fromStart) { try { audio.currentTime = 0; } catch (e) {} }
    var p;
    try { p = audio.play(); } catch (e) { set(audio.error ? 'error' : 'blocked'); return Promise.resolve(false); }
    return Promise.resolve(p).then(function () { return true; }, function () {
      set(audio.error ? 'error' : 'blocked');
      return false;
    });
  }
  function pause() { if (!audio.paused) audio.pause(); }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && !audio.paused) { hiddenPaused = true; audio.pause(); }
    else if (!document.hidden && hiddenPaused) { hiddenPaused = false; play(false); }
  });

  if ('mediaSession' in navigator && window.MediaMetadata) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: (C.music && C.music.title) || 'أغنية الزفاف',
        artwork: [{ src: 'assets/img/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }] });
      navigator.mediaSession.setActionHandler('play', function () { play(false); });
      navigator.mediaSession.setActionHandler('pause', pause);
    } catch (e) {}
  }

  window.WeddingMusic = {
    play: play,
    pause: pause,
    toggle: function () { if (!audio.paused) { pause(); return Promise.resolve(false); } return play(false); },
    setVolume: function (v) { audio.volume = Math.max(0, Math.min(1, v)); },
    onChange: function (fn) { listeners.push(fn); },
    get playing() { return !audio.paused && state === 'playing'; },
    get state() { return state; },
    element: audio
  };
})();

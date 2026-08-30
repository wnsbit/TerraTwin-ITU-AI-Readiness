/* ============================================================
   TerraTwin — Y.3172 pipeline trace
   ------------------------------------------------------------
   Renders the seven pipeline nodes and lights them in sequence
   each time a decision is processed, so the standard is visible
   as behaviour rather than as a table in a document.
   ============================================================ */

const Pipeline = (() => {
  let trackEl = null;
  let readoutEl = null;
  let running = false;

  function mount(trackSelector, readoutSelector) {
    trackEl = document.querySelector(trackSelector);
    readoutEl = document.querySelector(readoutSelector);
    if (!trackEl) return;

    trackEl.innerHTML = KB.pipeline
      .map(
        (n) => `
        <div class="pipe-node" data-node="${n.code}" title="${n.role}: ${n.standard}">
          <span class="code">${n.code}</span>
          <span class="role">${n.role}</span>
        </div>`
      )
      .join("");

    idle();
  }

  function idle() {
    if (readoutEl) {
      readoutEl.innerHTML =
        '<span class="tag">idle</span> waiting for a decision \u2014 each action runs the full pipeline.';
    }
  }

  function clearLights() {
    if (!trackEl) return;
    trackEl.querySelectorAll(".pipe-node").forEach((el) => {
      el.classList.remove("lit", "blocked");
    });
  }

  /*
    Runs the trace.
    steps: array of { code, text, blocked? }
    Returns a promise that resolves when the trace finishes.
  */
  function run(steps, speed) {
    if (!trackEl || running) return Promise.resolve();
    running = true;
    clearLights();

    const gap = speed || 260;

    return new Promise((resolve) => {
      let i = 0;

      function step() {
        if (i >= steps.length) {
          running = false;
          setTimeout(() => {
            clearLights();
            resolve();
          }, 900);
          return;
        }

        const s = steps[i];
        const node = trackEl.querySelector(`[data-node="${s.code}"]`);
        if (node) node.classList.add(s.blocked ? "blocked" : "lit");

        if (readoutEl) {
          const tagCls = s.blocked ? "tag stop" : "tag";
          readoutEl.innerHTML = `<span class="${tagCls}">${s.code}</span> ${s.text}`;
        }

        i++;

        // A blocked step ends the trace — output never reaches the SINK.
        if (s.blocked) {
          running = false;
          setTimeout(() => {
            clearLights();
            resolve();
          }, 1500);
          return;
        }

        setTimeout(step, gap);
      }

      step();
    });
  }

  return { mount, run, idle };
})();

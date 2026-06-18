'use strict';

class StickmanRobot {
  constructor(svgEl, onProcess) {
    this.svg = svgEl;
    this.onProcess = onProcess || (() => {});
    this.tickCount = 0;

    // Prime-interval processes in milliseconds: 2, 3, 5, 7, 11
    this.processes = [
      { name: 'heartbeat',   interval: 2000,  last: -9999 },
      { name: 'notify-scan', interval: 3000,  last: -9999 },
      { name: 'web-scan',    interval: 5000,  last: -9999 },
      { name: 'car-check',   interval: 7000,  last: -9999 },
      { name: 'decision',    interval: 11000, last: -9999 },
    ];

    this.activeState = 'idle';
    this.stateEnd = 0;
    this.els = {};
    this._buildSVG();
    requestAnimationFrame(t => this._loop(t));
  }

  _el(tag, attrs) {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  _buildSVG() {
    const { svg, _el: el, els } = this;
    svg.setAttribute('viewBox', '0 0 200 220');
    svg.setAttribute('width', '200');
    svg.setAttribute('height', '220');

    // Glow filter
    const defs = el.call(this, 'defs', {});
    const filt = el.call(this, 'filter', { id: 'sk-glow', x: '-40%', y: '-40%', width: '180%', height: '180%' });
    const blur = el.call(this, 'feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '2.5', result: 'b' });
    const merge = el.call(this, 'feMerge', {});
    merge.appendChild(el.call(this, 'feMergeNode', { in: 'b' }));
    merge.appendChild(el.call(this, 'feMergeNode', { in: 'SourceGraphic' }));
    filt.appendChild(blur);
    filt.appendChild(merge);
    defs.appendChild(filt);
    svg.appendChild(defs);

    // Scan ring (rotates)
    els.ring = el.call(this, 'circle', {
      cx: 100, cy: 110, r: 88, stroke: '#00ff88',
      'stroke-width': 0.6, fill: 'none', 'stroke-dasharray': '3 14', opacity: 0.2,
    });
    svg.appendChild(els.ring);

    // Body group
    const g = el.call(this, 'g', {
      stroke: '#00ff88', 'stroke-width': 2.5,
      'stroke-linecap': 'round', fill: 'none', filter: 'url(#sk-glow)',
    });

    els.antenna  = el.call(this, 'line', { x1: 100, y1: 18, x2: 100, y2: 5 });
    els.antTip   = el.call(this, 'circle', { cx: 100, cy: 4, r: 3.5, fill: '#00ff88', stroke: 'none' });
    els.head     = el.call(this, 'circle', { cx: 100, cy: 38, r: 20 });
    els.eyeL     = el.call(this, 'rect', { x: 87, y: 31, width: 8, height: 8, rx: 1, fill: '#00ff88', stroke: 'none' });
    els.eyeR     = el.call(this, 'rect', { x: 105, y: 31, width: 8, height: 8, rx: 1, fill: '#00ff88', stroke: 'none' });
    els.mouth    = el.call(this, 'rect', { x: 87, y: 44, width: 26, height: 6, rx: 2, 'stroke-width': 1.5 });
    els.body     = el.call(this, 'line', { x1: 100, y1: 58, x2: 100, y2: 130 });
    els.armL     = el.call(this, 'line', { x1: 100, y1: 76, x2: 58,  y2: 105 });
    els.armR     = el.call(this, 'line', { x1: 100, y1: 76, x2: 142, y2: 105 });
    els.legL     = el.call(this, 'line', { x1: 100, y1: 130, x2: 72,  y2: 182 });
    els.legR     = el.call(this, 'line', { x1: 100, y1: 130, x2: 128, y2: 182 });

    for (const e of [els.antenna, els.antTip, els.head, els.eyeL, els.eyeR,
        els.mouth, els.body, els.armL, els.armR, els.legL, els.legR]) {
      g.appendChild(e);
    }
    svg.appendChild(g);
    els.bodyGroup = g;
  }

  _setLimb(el, x2, y2) {
    el.setAttribute('x2', x2);
    el.setAttribute('y2', y2);
  }

  _resetDefaults() {
    const { els } = this;
    els.bodyGroup.setAttribute('stroke', '#00ff88');
    els.bodyGroup.setAttribute('transform', '');
    els.eyeL.setAttribute('fill', '#00ff88');
    els.eyeR.setAttribute('fill', '#00ff88');
    els.ring.setAttribute('stroke', '#00ff88');
    els.ring.setAttribute('opacity', '0.2');
    els.ring.setAttribute('stroke-dasharray', '3 14');
    this._setLimb(els.armL, 58,  105);
    this._setLimb(els.armR, 142, 105);
    this._setLimb(els.legL, 72,  182);
    this._setLimb(els.legR, 128, 182);
  }

  _loop(now) {
    // Check prime-interval processes
    for (const p of this.processes) {
      if (now - p.last >= p.interval) {
        p.last = now;
        this.tickCount++;
        const durations = {
          heartbeat: 350, 'notify-scan': 950,
          'web-scan': 1200, 'car-check': 1700, decision: 2400,
        };
        this.activeState = p.name;
        this.stateEnd = now + durations[p.name];
        this.onProcess(p.name, p.interval, this.tickCount);
      }
    }

    const state = now < this.stateEnd ? this.activeState : 'idle';

    this._resetDefaults();

    // Rotating scan ring
    const ringAngle = (now / 9000) * 360;
    this.els.ring.setAttribute('transform', `rotate(${ringAngle}, 100, 110)`);

    // Antenna tip pulse
    this.els.antTip.setAttribute('opacity', 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now * 0.006)));

    switch (state) {
      case 'idle':         this._animIdle(now);        break;
      case 'heartbeat':    this._animHeartbeat(now);   break;
      case 'notify-scan':  this._animScan(now);        break;
      case 'web-scan':     this._animThink(now);       break;
      case 'car-check':    this._animWalk(now);        break;
      case 'decision':     this._animAlert(now);       break;
    }

    requestAnimationFrame(t => this._loop(t));
  }

  _animIdle(now) {
    const sway = Math.sin(now * 0.0008) * 4;
    this.els.bodyGroup.setAttribute('transform', `translate(${sway * 0.4}, 0)`);
    this._setLimb(this.els.armL, 58  + sway * 0.3, 106);
    this._setLimb(this.els.armR, 142 + sway * 0.3, 106);
  }

  _animHeartbeat(now) {
    const p  = (now % 350) / 350;
    const sc = 1 + 0.09 * Math.sin(p * Math.PI);
    this.els.bodyGroup.setAttribute('transform',
      `translate(100,110) scale(${sc}) translate(-100,-110)`);
    this.els.eyeL.setAttribute('fill', '#ffffff');
    this.els.eyeR.setAttribute('fill', '#ffffff');
    this.els.ring.setAttribute('stroke', '#ffffff');
    this.els.ring.setAttribute('opacity', '0.65');
  }

  _animScan(now) {
    const sweep = Math.sin(now * 0.004) * 28;
    this._setLimb(this.els.armL, 52 + sweep, 88);
    this._setLimb(this.els.armR, 148 - sweep, 88);
    this.els.bodyGroup.setAttribute('stroke', '#00ffff');
    this.els.eyeL.setAttribute('fill', '#00ffff');
    this.els.eyeR.setAttribute('fill', '#00ffff');
    this.els.ring.setAttribute('stroke', '#00ffff');
    this.els.ring.setAttribute('opacity', '0.75');
    this.els.ring.setAttribute('stroke-dasharray', '2 5');
  }

  _animThink(now) {
    const tilt = Math.sin(now * 0.003) * 5;
    this.els.bodyGroup.setAttribute('transform', `translate(${tilt * 0.5}, 0)`);
    this._setLimb(this.els.armR, 112, 50);
    this._setLimb(this.els.armL, 70, 100);
    this.els.bodyGroup.setAttribute('stroke', '#ffcc00');
    this.els.eyeL.setAttribute('fill', '#ffcc00');
    this.els.eyeR.setAttribute('fill', '#ffcc00');
    this.els.ring.setAttribute('stroke', '#ffcc00');
    this.els.ring.setAttribute('opacity', '0.4');
  }

  _animWalk(now) {
    const phase = Math.sin(now * 0.005);
    const swing = phase * 28;
    this._setLimb(this.els.legL, 100 + swing, 180 - Math.abs(phase) * 6);
    this._setLimb(this.els.legR, 100 - swing, 180 - Math.abs(phase) * 6);
    this._setLimb(this.els.armL, 58 - swing * 0.55, 108);
    this._setLimb(this.els.armR, 142 + swing * 0.55, 108);
    const bob = Math.abs(phase) * 3;
    this.els.bodyGroup.setAttribute('transform', `translate(0, ${-bob})`);
  }

  _animAlert(now) {
    const flash = Math.floor(now / 240) % 2 === 0;
    const color = flash ? '#ff3333' : '#ff8800';
    const jx = (Math.random() - 0.5) * 3;
    const jy = (Math.random() - 0.5) * 2;
    this.els.bodyGroup.setAttribute('stroke', color);
    this.els.bodyGroup.setAttribute('transform', `translate(${jx}, ${jy})`);
    this.els.eyeL.setAttribute('fill', flash ? '#ff0000' : '#ffaa00');
    this.els.eyeR.setAttribute('fill', flash ? '#ff0000' : '#ffaa00');
    this._setLimb(this.els.armL, 50 + jx, 62 + jy);
    this._setLimb(this.els.armR, 150 + jx, 62 + jy);
    this.els.ring.setAttribute('stroke', color);
    this.els.ring.setAttribute('opacity', '0.8');
    this.els.ring.setAttribute('stroke-dasharray', '1 3');
  }

  triggerProcess(name) {
    const p = this.processes.find(x => x.name === name);
    if (p) p.last = -9999;
  }
}

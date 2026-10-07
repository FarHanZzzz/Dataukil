// The Add Money simulation's journal/packet pattern, with a separate topology for text requests.
import { h, svg, reducedMotion, simClock, hms } from './util.js';

const W = 178, H = 84;
const icons = { input: '↗', identity: '◎', api: '✦', classify: '⑂', public: '☏', reply: '↩', demo: '⌘', planner: '✧', gateway: '⇢', dna: '▧', blocked: '⊘', backend: '▣', audit: '≡' };

export class ChatPipeline {
  constructor(host, { onEvent = () => {} } = {}) {
    this.host = host;
    this.onEvent = onEvent;
    this.speed = 1;
    this.paused = false;
    this.generation = 0;
    this.reset();
  }

  build(topology) {
    this.topology = topology;
    this.host.replaceChildren();
    this.board = h('div', { class: 'pipeline-board' });
    this.board.style.width = topology.width + 'px';
    this.board.style.height = topology.height + 'px';
    this.canvas = svg('svg', { class: 'pipeline-edges', width: topology.width, height: topology.height, 'aria-hidden': 'true' });
    const defs = svg('defs', {}, svg('marker', { id: 'chat-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: '#a6b7ce' })));
    this.canvas.append(defs);
    this.nodes = new Map();
    this.paths = new Map();
    for (const item of topology.nodes) this.nodes.set(item.id, { ...item });
    for (const edge of topology.edges) {
      const a = this.nodes.get(edge.source), b = this.nodes.get(edge.target);
      let d;
      if (edge.source === 'audit' && edge.target === 'reply') {
        d = `M${a.x + W} ${a.y + H / 2} H1250 V${b.y + H / 2} H${b.x + W}`;
      } else if (a.y === b.y) {
        const right = b.x > a.x;
        d = `M${a.x + (right ? W : 0)} ${a.y + H / 2} L${b.x + (right ? 0 : W)} ${b.y + H / 2}`;
      } else if (a.x === b.x) {
        d = `M${a.x + W / 2} ${a.y + H} L${b.x + W / 2} ${b.y}`;
      } else {
        d = `M${a.x + W} ${a.y + H / 2} H${a.x + W + 14} V${b.y + H / 2} H${b.x}`;
      }
      // Protected storage is a deliberately closed route. It never receives an animated packet.
      if (edge.restricted) d = `M${a.x + W} ${a.y + H / 2} H1248 V${b.y + H / 2} H${b.x + W}`;
      const path = svg('path', { d, class: 'pipeline-edge' + (edge.restricted ? ' restricted' : ''), 'marker-end': 'url(#chat-arrow)' });
      this.paths.set(`${a.id}:${b.id}`, path);
      this.canvas.append(path);
    }
    this.packet = svg('g', { class: 'pipeline-packet', visibility: 'hidden' },
      svg('circle', { r: 13, class: 'packet-halo' }), svg('circle', { r: 5, class: 'packet-core' }));
    this.canvas.append(this.packet);
    this.board.append(this.canvas,
      h('div', { class: 'lane-label', css: { left: '30px', top: '20px' } }, '01 / RECEIVE & ROUTE'),
      h('div', { class: 'lane-label', css: { left: '645px', top: '187px' } }, '02 / DECEPTIVE REQUEST → PROPOSED READ'),
      h('div', { class: 'lane-label', css: { left: '235px', top: '355px' } }, '03 / FIVE METADATA CHECKS · NO SOURCE DATA'),
      h('div', { class: 'lane-label', css: { left: '30px', top: '535px' } }, '04 / RECORD & RESPOND'));
    for (const node of this.nodes.values()) {
      node.element = h('button', { type: 'button', class: `pipeline-node kind-${node.kind}`, dataset: { node: node.id },
        css: { left: node.x + 'px', top: node.y + 'px' }, onclick: () => this.inspect(node.id) },
        h('span', { class: 'node-icon' }, icons[node.id] || '◇'),
        h('span', { class: 'node-label' }, node.label),
        h('span', { class: 'node-detail' }, node.detail),
        h('span', { class: 'node-state' }, node.id === 'backend' ? 'NOT CALLED' : 'WAITING'));
      this.board.append(node.element);
    }
    this.host.append(this.board);
    this.reset();
  }

  reset() {
    this.generation += 1;
    this.queue = [];
    this.seen = new Set();
    this.events = [];
    this.playing = false;
    this.paused = false;
    if (this.packet) this.packet.setAttribute('visibility', 'hidden');
    if (this.nodes) for (const node of this.nodes.values()) {
      node.state = 'waiting';
      node.last = null;
      node.element.dataset.state = 'waiting';
      node.element.querySelector('.node-state').textContent = node.id === 'backend' ? 'NOT CALLED' : 'WAITING';
    }
    if (this.paths) for (const path of this.paths.values()) path.classList.remove('visited');
  }

  inspect(id) {
    const node = this.nodes.get(id);
    document.getElementById('node-title').textContent = node.label;
    document.getElementById('node-inspector').textContent = node.last?.detail || node.detail + '. This stage has not been visited by this request.';
    document.getElementById('node-meta').textContent = node.last ? `${node.last.state.toUpperCase()} · ${hms(node.last.occurred_at)}${node.last.tool ? ' · ' + node.last.tool : ''}` : 'Select any node to inspect its saved backend event.';
    for (const n of this.nodes.values()) n.element.classList.toggle('selected', n.id === id);
  }

  append(events, animate = true) {
    for (const event of events) {
      if (this.seen.has(event.sequence)) continue;
      this.seen.add(event.sequence);
      if (animate) this.queue.push(event);
      else this.apply(event);
    }
    if (animate && !this.playing) this.play(this.generation);
  }

  apply(event) {
    const node = this.nodes.get(event.node);
    if (!node) return;
    node.last = event;
    node.state = event.state;
    node.element.dataset.state = event.state;
    node.element.querySelector('.node-state').textContent = event.node === 'backend' ? 'NOT CALLED' : event.state.toUpperCase();
    this.events.push(event);
    document.getElementById('pipeline-clock').textContent = simClock(event.sim_ms);
    document.getElementById('pipeline-phase').textContent = node.label + ' · ' + event.state;
    this.inspect(event.node);
    this.onEvent(event);
  }

  async play(generation) {
    this.playing = true;
    while (this.queue.length && generation === this.generation) {
      while (this.paused && generation === this.generation) await new Promise(resolve => setTimeout(resolve, 80));
      if (generation !== this.generation) return;
      const event = this.queue.shift();
      const path = this.paths.get(`${event.source}:${event.node}`);
      const duration = reducedMotion() ? 0 : 450 / this.speed;
      if (path && event.node !== 'backend') {
        path.classList.add('visited');
        this.packet.setAttribute('visibility', 'visible');
        const length = path.getTotalLength();
        let elapsed = 0, previous = performance.now();
        await new Promise(resolve => {
          const frame = now => {
            if (generation !== this.generation) return resolve();
            if (!this.paused) elapsed += now - previous;
            previous = now;
            const point = path.getPointAtLength(length * Math.min(1, duration ? elapsed / duration : 1));
            this.packet.setAttribute('transform', `translate(${point.x},${point.y})`);
            if (elapsed < duration) requestAnimationFrame(frame); else resolve();
          };
          requestAnimationFrame(frame);
        });
      } else if (duration) await new Promise(resolve => setTimeout(resolve, duration / 2));
      if (generation !== this.generation) return;
      this.apply(event);
    }
    if (generation === this.generation) {
      this.playing = false;
      this.packet.setAttribute('visibility', 'hidden');
    }
  }

  async settled() {
    const generation = this.generation;
    while ((this.playing || this.queue.length) && generation === this.generation) await new Promise(resolve => setTimeout(resolve, 80));
  }
}

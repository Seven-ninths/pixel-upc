(() => {
  'use strict';

  const seasons = new Set(['spring', 'summer', 'autumn', 'winter']);
  const walkGoal = 120;
  const catSpots = [
    { id: 'sea-salt', name: '海盐', label: '南门', offset: [-8, -24], color: '#e9d5b7' },
    { id: 'orange-wave', name: '浪花', label: '子元广场', offset: [-9, 11], color: '#d88c53' },
    { id: 'pinecone', name: '松塔', label: '求索园', offset: [-11, 12], color: '#9d9ca7' },
    { id: 'walnut', name: '核桃', label: '荟萃广场', offset: [9, -4], color: '#b08d71' },
    { id: 'bookmark', name: '书签', label: '图书馆东馆', offset: [-35, 18], color: '#616779' },
  ];

  function walkableNear(point, blocked, canReach = () => true) {
    for (let radius = 0; radius <= 48; radius += 2) {
      for (let step = 0; step < (radius ? 12 : 1); step++) {
        const angle = step * Math.PI / 6;
        const x = point.x + Math.cos(angle) * radius;
        const y = point.y + Math.sin(angle) * radius;
        if (!blocked(x, y) && canReach({ x, y })) return { x, y };
      }
    }
    return null;
  }

  function segmentDistance(point, segment) {
    const dx = point.x - segment.x, dy = point.y - segment.y;
    const t = Math.max(0, Math.min(1, (dx * segment.dx + dy * segment.dy) / segment.lengthSquared));
    return Math.hypot(dx - t * segment.dx, dy - t * segment.dy);
  }

  function create(world, blocked) {
    const units = world.geo.unitsPerMeter;
    const labels = new Map(world.labels.map(label => [label.name, label]));
    const gate = labels.get('南门') || world.spawn;
    const progress = [
      { id: 'gate', label: '在南门领取巡游通行章', done: false },
      { id: 'avenue', label: '沿光华大道累计走 120 米', done: false },
      { id: 'main-library', label: '到访图书馆总馆', done: false },
      { id: 'cat', label: '结识一只校园猫', done: false },
      { id: 'east-library', label: '到访图书馆东馆', done: false },
    ];
    const checks = new Map(progress.map(item => [item.id, item]));
    const visits = new Map([['图书馆总馆', 'main-library'], ['图书馆东馆', 'east-library']]);
    const cats = catSpots.flatMap(({ id, name, label, offset, color }) => {
      const anchor = labels.get(label);
      if (!anchor) return [];
      const [dx, dy] = offset;
      const position = walkableNear({ x: anchor.x + dx, y: anchor.y + dy }, blocked);
      return position ? [{ id, name, color, ...position, found: false, follow: false, dir: 'right', moving: false }] : [];
    });
    const followers = [];
    const avenue = world.roads
      .filter(road => road.name === '光华大道' && !road.tunnel && !(road.layer < 0))
      .flatMap(road => road.points.slice(1).map(([x1, y1], i) => {
        const [x, y] = road.points[i];
        const dx = x1 - x, dy = y1 - y;
        return { x, y, dx, dy, lengthSquared: dx * dx + dy * dy, margin: road.width / 2 + units * 3 };
      }))
      .filter(segment => segment.lengthSquared > 0);
    let season = 'summer';
    let distance = 0;
    let previous;
    let trailPoint;
    const pathStep = units * 0.4;

    function onAvenue(point) {
      return avenue.some(segment => segmentDistance(point, segment) <= segment.margin);
    }

    function visit(name) {
      const item = checks.get(visits.get(name));
      if (item) item.done = true;
    }

    function clearLine(a, b) {
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / pathStep));
      for (let i = 1; i <= steps; i++) {
        if (blocked(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps)) return false;
      }
      return true;
    }

    function connectTrail(from, target) {
      if (clearLine(from, target)) return [target];
      // Axis-resolved walking can already have gone around a corner between
      // frames. Keep that bend in the trail instead of cutting across it.
      const corners = [{ x: target.x, y: from.y }, { x: from.x, y: target.y }];
      for (const corner of corners) {
        if (clearLine(from, corner) && clearLine(corner, target)) return [corner, target];
      }
      const middle = { x: (from.x + target.x) / 2, y: (from.y + target.y) / 2 };
      for (let radius = pathStep; radius <= units * 4; radius += pathStep) {
        for (let i = 0; i < 8; i++) {
          const angle = i * Math.PI / 4;
          const bend = { x: middle.x + Math.cos(angle) * radius, y: middle.y + Math.sin(angle) * radius };
          if (clearLine(from, bend) && clearLine(bend, target)) return [bend, target];
        }
      }
      return [];
    }

    function appendPoint(follower, point) {
      const last = follower.trail.at(-1) || follower.cat;
      const gap = Math.hypot(point.x - last.x, point.y - last.y);
      if (gap < 0.001) return;
      follower.trail.push(point);
      follower.remaining += gap;
    }

    function interact(player) {
      const gateCheck = checks.get('gate');
      if (!gateCheck.done && Math.hypot(player.x - gate.x, player.y - gate.y) < 25) {
        gateCheck.done = true;
        return {
          title: '南门欢迎站',
          text: '欢迎来到唐岛湾！你的校园巡游通行章已经盖好。沿光华大道走走，遇见同学时可以停下来打个招呼。',
        };
      }
      let chosen = null, nearest = 8;
      for (const cat of cats) {
        const gap = Math.hypot(cat.x - player.x, cat.y - player.y);
        if (gap < nearest && clearLine(cat, player)) {
          chosen = cat;
          nearest = gap;
        }
      }
      if (!chosen) return null;
      if (chosen.found) {
        return { title: chosen.name, text: chosen.follow ? '它慢慢眨了眨眼，准备继续陪你散步。' : '它认出了你，在原地伸了个懒腰。' };
      }
      chosen.found = true;
      checks.get('cat').done = true;
      if (followers.length < 3) {
        chosen.follow = true;
        const follower = { cat: chosen, trail: [], remaining: 0, phase: 0, turnDistance: 0 };
        appendPoint(follower, { x: player.x, y: player.y });
        followers.push(follower);
        return { title: '认识了' + chosen.name, text: '它凑近闻了闻，决定跟在你身后走一段。' };
      }
      return { title: '认识了' + chosen.name, text: '它在这里晒太阳，等你下次再来打招呼。' };
    }

    function moveFollower(follower, index, dt) {
      const { cat, trail } = follower;
      const gap = (index + 1) * units * 4.5;
      const startX = cat.x, startY = cat.y;
      let travelled = 0;
      let allowance = Math.min(dt * units * 150, follower.remaining - gap);
      while (allowance > 0.0001 && trail.length) {
        const target = trail[0];
        const dx = target.x - cat.x, dy = target.y - cat.y;
        const length = Math.hypot(dx, dy);
        if (length < 0.001) {
          trail.shift();
          continue;
        }
        const step = Math.min(length, allowance, pathStep);
        const x = cat.x + dx * step / length;
        const y = cat.y + dy * step / length;
        if (blocked(x, y)) {
          // Rejoin the earliest visible part of the trail if a tiny corner
          // invalidates the first segment. The connector is collision-tested.
          const rejoin = trail.findIndex(point => clearLine(cat, point));
          if (rejoin < 1) {
            const detour = connectTrail(cat, target);
            if (detour.length > 1) trail.unshift(detour[0]);
            else break;
          } else {
            trail.splice(0, rejoin);
          }
          follower.remaining = trail.reduce((sum, point, i) => {
            const origin = i ? trail[i - 1] : cat;
            return sum + Math.hypot(point.x - origin.x, point.y - origin.y);
          }, 0);
          allowance = Math.min(allowance, follower.remaining - gap);
          continue;
        }
        cat.x = x;
        cat.y = y;
        follower.remaining = Math.max(0, follower.remaining - step);
        travelled += step;
        allowance -= step;
      }
      const dx = cat.x - startX, dy = cat.y - startY;
      const direction = dx < 0 ? 'left' : 'right';
      if (Math.abs(dx) > Math.abs(dy) * 0.55 && direction !== cat.dir) {
        follower.turnDistance += Math.abs(dx);
        if (follower.turnDistance >= units * 0.45) {
          cat.dir = direction;
          follower.turnDistance = 0;
        }
      } else follower.turnDistance = 0;
      cat.moving = travelled > 0.001;
      if (cat.moving) {
        const stride = Math.min(travelled / (units * 7), dt * 7);
        follower.phase = (follower.phase + stride * 2 * Math.PI) % (2 * Math.PI);
        cat.gait = Math.sin(follower.phase);
      } else {
        cat.gait = (cat.gait || 0) * Math.max(0, 1 - dt * 12);
      }
    }

    function resetPosition(player) {
      previous = { x: player.x, y: player.y };
      trailPoint = previous;
      for (const [index, follower] of followers.entries()) {
        const position = walkableNear({
          x: player.x + (index % 2 ? 1 : -1) * units * (3 + index),
          y: player.y + units * (5 + 3 * index),
        }, blocked, point => clearLine(previous, point));
        Object.assign(follower.cat, position || previous, { moving: false, gait: 0 });
        follower.trail = [];
        follower.remaining = 0;
        follower.phase = 0;
        follower.turnDistance = 0;
        appendPoint(follower, previous);
      }
    }

    function update(player, dt, walkedPoints = []) {
      const position = { x: player.x, y: player.y };
      const displacement = previous ? Math.hypot(position.x - previous.x, position.y - previous.y) : 0;
      if (displacement > units * (170 * dt + 2)) {
        resetPosition(player);
        return;
      }
      if (previous && player.moving && displacement > 0 && distance < walkGoal &&
          onAvenue(previous) && onAvenue(position)) {
        distance = Math.min(walkGoal, distance + displacement / units);
        if (distance >= walkGoal) checks.get('avenue').done = true;
      }
      previous = position;
      if (!trailPoint || !followers.length) trailPoint = position;
      if (followers.length) {
        for (const point of [...walkedPoints, position]) {
          if (Math.hypot(point.x - trailPoint.x, point.y - trailPoint.y) < 0.001) continue;
          const sections = connectTrail(trailPoint, point);
          for (const section of sections) {
            for (const follower of followers) appendPoint(follower, section);
            trailPoint = section;
          }
        }
      }
      followers.forEach((follower, index) => moveFollower(follower, index, dt));
    }

    return {
      update, interact, visit, resetPosition,
      setSeason(id) { if (seasons.has(id)) season = id; },
      get season() { return season; },
      get progress() { return progress; },
      get cats() { return cats; },
      get distance() { return distance; },
    };
  }

  window.PixelActivities = { create };
})();

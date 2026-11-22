(() => {
  'use strict';

  const tileColors = {
    park: '#aebf93', forest: '#9eaf81', water: '#78a8a7',
    sport: '#b78372', plaza: '#d6d0b6', sand: '#d8d0ab', paved: '#cbcbbb',
    grass: '#aaba8d',
  };
  const roofColors = {
    library: '#afc9d2', 'east-library': '#86a578', sport: '#c7d2ca',
    residence: '#dcb597', teaching: '#c7d5d4', gate: '#e7deca',
    dining: '#d9b4a2', landmark: '#ccaa6f', service: '#dcd8c3',
  };
  const roadColors = {
    road: ['#c2c9c0', '#999f99'],
    ramp: ['#9eaa9d', '#788681'],
    service: ['#b9b9a5', '#cccbb7'],
    main: ['#c7c4aa', '#ddd6bd'],
    footway: ['#b9bca1', '#d6ceb3'],
    path: ['#b9bca1', '#d6ceb3'],
    steps: ['#b7b7a1', '#bbb69f'],
  };
  const seasons = {
    spring: { outside: '#b8c5a8', grass: '#a9c381', forest: '#99b57d', trees: ['#c78c8c', '#62855e', '#ebbdad', '#8eac73'] },
    summer: { outside: '#b8c1a8', grass: '#a2b988', forest: '#9eaf81', trees: ['#63825f', '#587e67', '#8da46b', '#77a282'] },
    autumn: { outside: '#c6bdab', grass: '#c0b071', forest: '#b6a071', trees: ['#ae754a', '#b0804f', '#e0ad62', '#ce9470'] },
    winter: { outside: '#cbd7d9', grass: '#e0e8e5', forest: '#c9d9d2', trees: ['#718981', '#67837d', '#e9f2ee', '#d6e4df'] },
  };
  let terrain;
  let cachedWorld;
  let cachedSeason;
  const overviewPadding = 24;

  function density(canvas) {
    return canvas.clientWidth ? canvas.width / canvas.clientWidth : 1;
  }

  function path(ctx, points, closed = true) {
    ctx.beginPath();
    if (!points.length) return;
    ctx.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
    if (closed) ctx.closePath();
  }

  function hash(x, y) {
    const n = Math.imul(x + 1229, 1597334677) ^ Math.imul(y + 2047, 3812015801);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function round(value, unit) {
    return Math.round(value / unit) * unit;
  }

  function fillTree(ctx, x, y, size, variant, colors) {
    ctx.fillStyle = '#829371';
    ctx.fillRect(x, y + size, size * 2, size);
    ctx.fillStyle = colors[variant > 0.57 ? 0 : 1];
    ctx.fillRect(x - size, y - size, size * 2, size * 2);
    ctx.fillRect(x - size * 1.4, y - size * 0.48, size * 2.8, size);
    ctx.fillStyle = colors[variant > 0.57 ? 2 : 3];
    ctx.fillRect(x - size * 0.67, y - size * 0.8, size * 1.2, size);
  }

  function edgesOf(points, clearance = 0, closed = false) {
    const edges = [];
    for (let i = closed ? 0 : 1; i < points.length; i++) {
      const [x, y] = points.at(i - 1), [endX, endY] = points[i];
      const dx = endX - x, dy = endY - y;
      const length = dx * dx + dy * dy;
      if (!length) continue;
      edges.push({
        x, y, dx, dy, length, clearance,
        left: Math.min(x, endX) - clearance, right: Math.max(x, endX) + clearance,
        top: Math.min(y, endY) - clearance, bottom: Math.max(y, endY) + clearance,
      });
    }
    return edges;
  }

  function touchesEdge(edges, x, y, radius) {
    for (const edge of edges) {
      if (x + radius < edge.left || x - radius > edge.right ||
          y + radius < edge.top || y - radius > edge.bottom) continue;
      const dx = x - edge.x, dy = y - edge.y;
      const t = Math.max(0, Math.min(1, (dx * edge.dx + dy * edge.dy) / edge.length));
      if ((dx - t * edge.dx) ** 2 + (dy - t * edge.dy) ** 2 < (radius + edge.clearance) ** 2) return true;
    }
    return false;
  }

  function insideEdges(edges, x, y) {
    let inside = false;
    for (const edge of edges) {
      if ((edge.y > y) !== (edge.y + edge.dy > y) &&
          x < edge.x + (y - edge.y) * edge.dx / edge.dy) inside = !inside;
    }
    return inside;
  }

  function drawTrees(ctx, area, unit, roads, occupied, colors) {
    const xs = area.points.map(([x]) => x);
    const ys = area.points.map(([, y]) => y);
    const bounds = edgesOf(area.points, 0, true);
    const lawn = area.kind === 'grass';
    const spacing = unit * (area.kind === 'forest' ? 6.5 : lawn ? 11.5 : 9.2);
    for (let y = Math.min(...ys) + spacing / 2; y < Math.max(...ys); y += spacing) {
      for (let x = Math.min(...xs) + spacing / 2; x < Math.max(...xs); x += spacing) {
        const random = hash(x | 0, y | 0);
        if (random < (lawn ? 0.74 : 0.38)) continue;
        const px = round(x + (random - 0.5) * spacing, unit);
        const py = round(y + (hash(y | 0, x | 0) - 0.5) * spacing, unit);
        const size = unit * (lawn ? 0.52 + random * 0.42 : 0.84 + random * 0.68);
        // Include the whole crown and the shadow toward the lower right.
        const radius = size * Math.sqrt(8) + unit * 0.2;
        if (!insideEdges(bounds, px, py) || touchesEdge(bounds, px, py, radius) ||
            touchesEdge(roads, px, py, radius)) continue;
        if (occupied.some(shape =>
          px + radius >= shape.left && px - radius <= shape.right &&
          py + radius >= shape.top && py - radius <= shape.bottom &&
          (insideEdges(shape.edges, px, py) || touchesEdge(shape.edges, px, py, radius))
        )) continue;
        fillTree(ctx, px, py, size, random, colors);
      }
    }
  }

  function drawSunSculpture(ctx, x, y, unit) {
    ctx.fillStyle = '#6b695767';
    ctx.fillRect(x - unit, y + unit, 3.2 * unit, unit);
    ctx.fillStyle = '#858a72';
    ctx.fillRect(x - 1.6 * unit, y - 0.55 * unit, 3.2 * unit, 1.4 * unit);
    ctx.fillStyle = '#c6924e';
    ctx.fillRect(x - 0.7 * unit, y - 2.1 * unit, 1.4 * unit, 1.7 * unit);
    ctx.fillRect(x - 1.35 * unit, y - 1.35 * unit, 2.7 * unit, 0.48 * unit);
    ctx.fillStyle = '#f4d688';
    ctx.fillRect(x - 0.5 * unit, y - 2.15 * unit, 0.85 * unit, 0.85 * unit);
  }

  function drawArea(ctx, area, unit, palette) {
    path(ctx, area.points);
    ctx.fillStyle = area.kind === 'park' ? palette.grass : palette[area.kind] || tileColors[area.kind] || palette.grass;
    ctx.fill();
    ctx.strokeStyle = area.kind === 'water' ? '#639a9c' : '#a1ad88';
    ctx.lineWidth = unit;
    ctx.stroke();
  }

  function drawRoad(ctx, road, unit, casing) {
    const [edge, surface] = roadColors[road.vehicleRamp ? 'ramp' : road.kind] || roadColors.path;
    path(ctx, road.points, false);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = casing ? edge : surface;
    ctx.lineWidth = road.width + (casing ? unit * 0.95 : 0);
    ctx.stroke();
    if (!casing && road.kind === 'road' && road.width >= unit * 6) {
      ctx.setLineDash([unit * 3, unit * 3]);
      ctx.strokeStyle = '#d5d4b8';
      ctx.lineWidth = unit * 0.52;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawRoof(ctx, building, unit) {
    const { points, kind } = building;
    ctx.save();
    ctx.translate(unit * 1.65, unit * 2.1);
    path(ctx, points);
    ctx.fillStyle = '#536a5c54';
    ctx.fill();
    ctx.restore();

    path(ctx, points);
    ctx.fillStyle = roofColors[kind] || '#d8dad1';
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#708483';
    ctx.lineWidth = unit * 0.88;
    ctx.stroke();
    ctx.save();
    ctx.clip();
    const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
    const left = Math.min(...xs), top = Math.min(...ys);
    const width = Math.max(...xs) - left, bottom = Math.max(...ys);
    ctx.fillStyle = kind === 'east-library' ? '#ebefc430' : '#4c69721b';
    const seam = unit * (kind === 'east-library' ? 5 : 4);
    for (let y = Math.ceil(top / seam) * seam; y < bottom; y += seam) {
      ctx.fillRect(left, y, width, unit * 0.32);
    }
    ctx.translate(-unit * 0.85, -unit * 0.9);
    path(ctx, points);
    ctx.strokeStyle = '#f5f6da9c';
    ctx.lineWidth = unit * 1.3;
    ctx.stroke();
    ctx.restore();
  }

  function getTerrain(world, season = 'summer') {
    if (terrain && cachedWorld === world && cachedSeason === season) return terrain;
    const palette = seasons[season] || seasons.summer;
    const canvas = document.createElement('canvas');
    const rasterScale = Math.min(4, 4096 / Math.max(world.width, world.height));
    canvas.width = Math.ceil(world.width * rasterScale);
    canvas.height = Math.ceil(world.height * rasterScale);
    const ctx = canvas.getContext('2d');
    ctx.scale(rasterScale, rasterScale);
    const unit = world.width / 660;
    ctx.fillStyle = palette.outside;
    ctx.fillRect(0, 0, world.width, world.height);
    path(ctx, world.boundary);
    ctx.fillStyle = palette.grass;
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let y = 0; y < world.height; y += unit * 4) {
      for (let x = 0; x < world.width; x += unit * 4) {
        const n = hash(Math.round(x), Math.round(y));
        if (n > 0.83 || n < 0.12) {
          ctx.fillStyle = n > 0.83 ? '#dfdb9b36' : '#667f621c';
          ctx.fillRect(x, y, unit * 2, unit);
        }
      }
    }
    ctx.restore();

    for (const area of world.areas) drawArea(ctx, area, unit, palette);
    path(ctx, world.boundary);
    ctx.lineWidth = unit * 1.2;
    ctx.strokeStyle = '#718a77';
    ctx.stroke();
    const visibleRoads = world.roads.filter(road => !road.tunnel && !(road.layer < 0));
    const roadEdges = visibleRoads.flatMap(road => edgesOf(road.points, (road.width + unit * 0.95) / 2));
    const occupied = [...world.buildings, ...world.areas.filter(area => area.kind === 'water' || area.kind === 'plaza')].map(feature => {
      const x = feature.points.map(point => point[0]), y = feature.points.map(point => point[1]);
      return { edges: edgesOf(feature.points, 0, true), left: Math.min(...x), right: Math.max(...x), top: Math.min(...y), bottom: Math.max(...y) };
    });
    for (const area of world.areas) {
      if (area.kind === 'park' || area.kind === 'forest' || area.kind === 'grass') {
        drawTrees(ctx, area, unit, roadEdges, occupied, palette.trees);
      }
    }
    const ground = visibleRoads.filter(road => !road.bridge && !(road.layer > 0));
    const bridges = visibleRoads.filter(road => road.bridge || road.layer > 0);
    for (const layer of [ground, bridges]) {
      for (const road of layer) drawRoad(ctx, road, unit, true);
      for (const road of layer) drawRoad(ctx, road, unit, false);
    }
    for (const building of world.buildings) drawRoof(ctx, building, unit);
    const sun = world.labels.find(label => label.name === '创造太阳');
    if (sun) drawSunSculpture(ctx, sun.x, sun.y, unit);
    terrain = canvas;
    cachedWorld = world;
    cachedSeason = season;
    return canvas;
  }

  function drawPlayer(ctx, player, x, y, now, scale) {
    const size = Math.max(1, Math.round(scale));
    const step = player.moving ? (Math.floor(now / 115) % 2 ? 1 : -1) * size : 0;
    x = Math.round(x);
    y = Math.round(y);
    ctx.fillStyle = '#253d3d63';
    ctx.fillRect(x - 3 * size, y + size, 7 * size, 2 * size);
    if (player.cycling) {
      ctx.strokeStyle = '#273b39';
      ctx.lineWidth = size;
      ctx.beginPath();
      const horizontal = player.dir === 'left' || player.dir === 'right';
      ctx.arc(x - (horizontal ? 5 : 0) * size, y - size, 2 * size, 0, 2 * Math.PI);
      ctx.moveTo(x + (horizontal ? 7 : 2) * size, y + (horizontal ? -1 : 3) * size);
      ctx.arc(x + (horizontal ? 5 : 0) * size, y + (horizontal ? -1 : 3) * size, 2 * size, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.fillStyle = '#b16e4c';
      ctx.fillRect(x - 5 * size, y - 2 * size, 10 * size, size);
    }
    ctx.fillStyle = '#263944';
    ctx.fillRect(x - size * 2, y - size, size * 2, size * 2 + step);
    ctx.fillRect(x + size, y - size, size * 2, size * 2 - step);
    ctx.fillStyle = player.skin || '#fff2cc';
    ctx.fillRect(x - 2 * size, y - 10 * size, 5 * size, 5 * size);
    ctx.fillStyle = player.hair || '#263f47';
    ctx.fillRect(x - 3 * size, y - 11 * size, 7 * size, 2 * size);
    ctx.fillStyle = player.color || '#405f6a';
    ctx.fillRect(x - 3 * size, y - 6 * size, 7 * size, 5 * size);
    ctx.fillStyle = '#dc8c62';
    const side = player.dir === 'right' ? -3 : player.dir === 'left' ? 2 : -2;
    ctx.fillRect(x + side * size, y - 5 * size, 2 * size, 3 * size);
  }

  function drawCar(ctx, car, x, y, scale) {
    const length = scale * 2.75, width = scale * 1.35;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(car.angle || 0);
    ctx.fillStyle = '#25353260';
    ctx.fillRect(-length * 0.46, -width * 0.35, length, width);
    ctx.fillStyle = '#26383a';
    ctx.fillRect(-length / 2, -width * 0.55, length, width * 1.1);
    ctx.fillStyle = car.color || '#c77d57';
    ctx.fillRect(-length * 0.47, -width * 0.46, length * 0.94, width * 0.92);
    ctx.fillStyle = '#314e60';
    ctx.fillRect(-length * 0.22, -width * 0.35, length * 0.47, width * 0.7);
    ctx.fillStyle = '#96c0c7';
    ctx.fillRect(length * 0.15, -width * 0.32, length * 0.1, width * 0.64);
    ctx.fillStyle = '#fff3c1';
    ctx.fillRect(length * 0.4, -width * 0.35, length * 0.065, width * 0.21);
    ctx.fillRect(length * 0.4, width * 0.15, length * 0.065, width * 0.21);
    ctx.restore();
  }

  function drawCat(ctx, cat, x, y, pixels) {
    const u = Math.max(1, Math.round(2 * pixels));
    const step = Math.round((cat.gait || 0) * u);
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(cat.dir === 'left' ? -1 : 1, 1);
    ctx.fillStyle = '#263a3760';
    ctx.fillRect(-4 * u, 0, 9 * u, 2 * u);
    ctx.fillStyle = cat.color || '#dcad77';
    ctx.fillRect(-3 * u, -4 * u, 7 * u, 4 * u);
    ctx.fillRect(u, -6 * u, 4 * u, 4 * u);
    ctx.fillRect(u, -7 * u, u, u);
    ctx.fillRect(4 * u, -7 * u, u, u);
    ctx.fillRect(-5 * u, -5 * u, 2 * u, u);
    ctx.fillRect(-2 * u, -step, u, u);
    ctx.fillRect(2 * u, step, u, u);
    ctx.fillStyle = '#282b2a';
    ctx.fillRect(3 * u, -5 * u, u, u);
    ctx.restore();
  }

  function drawWeather(ctx, width, height, pixels, season, minutes, now, weather) {
    if (minutes >= 1140 || minutes < 360) {
      ctx.fillStyle = '#182e5b61';
      ctx.fillRect(0, 0, width, height);
    } else if (minutes >= 1020) {
      ctx.fillStyle = '#bf75302c';
      ctx.fillRect(0, 0, width, height);
    }
    if (weather === 'rain') {
      ctx.fillStyle = '#566d7e55';
      ctx.fillRect(0, 0, width, height);
      ctx.beginPath();
      for (let i = 0; i < 112; i++) {
        const x = (hash(i, 42) * width + now * 0.039 * pixels) % width;
        const y = (hash(i, 98) * height + now * (0.19 + hash(i, 12) * 0.21) * pixels) % height;
        ctx.moveTo(x, y);
        ctx.lineTo(x + 3 * pixels, y + 10 * pixels);
      }
      ctx.strokeStyle = '#d7edf58a';
      ctx.lineWidth = pixels;
      ctx.stroke();
      return;
    }
    if (weather ? weather !== 'snow' : season !== 'winter') return;
    ctx.fillStyle = '#fbffffd9';
    for (let i = 0; i < 56; i++) {
      const x = (hash(i, 31) * width + now * 0.018 * pixels) % width;
      const y = (hash(i, 99) * height + now * (0.017 + hash(i, 15) * 0.023) * pixels) % height;
      const size = (1 + (i % 3)) * pixels;
      ctx.fillRect(Math.round(x), Math.round(y), size, size);
    }
  }

  function labelsAt(ctx, labels, project, width, height, pixels, fontSize, rankLimit, mapMode) {
    const selected = [...labels].sort((a, b) => (a.rank ?? 3) - (b.rank ?? 3));
    const occupied = [];
    ctx.font = '600 ' + fontSize + 'px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const label of selected) {
      if ((label.rank ?? 3) > rankLimit) continue;
      const [x, y] = project(label.x, label.y);
      if (x < 2 || x > width - 2 || y < 2 || y > height + fontSize) continue;
      const padding = (mapMode ? 4 : 5) * pixels;
      const w = Math.ceil(ctx.measureText(label.name).width) + padding * 2;
      const h = fontSize + Math.round(padding * 1.1);
      const left = Math.floor(x - w / 2), top = Math.floor(y - h - 4 * pixels);
      if (left < 2 || left + w > width - 2 || top < 2 || top + h > height - 2) continue;
      if (occupied.some(box => left < box.right && left + w > box.left && top < box.bottom && top + h > box.top)) continue;
      occupied.push({ left: left - 3, right: left + w + 3, top: top - 3, bottom: top + h + 3 });
      ctx.fillStyle = mapMode ? '#264349ef' : '#153b38f2';
      ctx.fillRect(left, top, w, h);
      ctx.fillStyle = '#fcf5d9';
      ctx.fillText(label.name, Math.round(x), Math.round(top + h / 2) + 0.5);
    }
  }

  function drawRoute(ctx, route, project, pixels) {
    if (route.length < 2) return;
    path(ctx, route.map(point => project(point.x, point.y)), false);
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#254c42c7';
    ctx.lineWidth = 6 * pixels;
    ctx.stroke();
    ctx.setLineDash([7 * pixels, 5 * pixels]);
    ctx.strokeStyle = '#ffe29a';
    ctx.lineWidth = 3 * pixels;
    ctx.stroke();
    ctx.restore();
  }

  function drawScene(canvas, world, player, now, route = [], life = {}) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const pixels = density(canvas);
    const terrainCanvas = getTerrain(world, life.season);
    const campusHeight = world.campusBounds.bottom - world.campusBounds.top;
    const viewHeight = Math.min(117, Math.max(98, campusHeight * 0.19));
    const scale = Math.max(height / viewHeight, width / world.width);
    const viewportWidth = width / scale, viewportHeight = height / scale;
    const left = Math.max(0, Math.min(world.width - viewportWidth, player.x - viewportWidth / 2));
    const top = Math.max(0, Math.min(world.height - viewportHeight, player.y - viewportHeight * 0.54));
    const project = (x, y) => [(x - left) * scale, (y - top) * scale];
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#b8c1a8';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(terrainCanvas,
      left * terrainCanvas.width / world.width, top * terrainCanvas.height / world.height,
      viewportWidth * terrainCanvas.width / world.width, viewportHeight * terrainCanvas.height / world.height,
      0, 0, width, height);
    drawRoute(ctx, route, project, pixels);
    const inView = ([x, y]) => x > -55 * pixels && x < width + 55 * pixels && y > -55 * pixels && y < height + 55 * pixels;
    for (const car of life.vehicles || []) {
      const point = project(car.x, car.y);
      if (inView(point)) drawCar(ctx, car, ...point, scale);
    }
    const population = [
      ...(life.students || []).map(person => ({ person, cat: false })),
      ...(life.cats || []).map(person => ({ person, cat: true })),
      { person: player, cat: false },
    ].sort((a, b) => a.person.y - b.person.y);
    for (const { person, cat } of population) {
      const point = project(person.x, person.y);
      if (!inView(point)) continue;
      if (cat) drawCat(ctx, person, ...point, pixels);
      else drawPlayer(ctx, person, ...point, now + (person.phase || 0), (person === player ? 3 : 2.35) * pixels);
    }
    drawWeather(ctx, width, height, pixels, life.season, life.minutes, now, life.weather);
    labelsAt(ctx, world.labels, project, width, height, pixels, Math.round(13 * pixels), 3, false);
    if (life.highlight) {
      const [x, y] = project(life.highlight.x, life.highlight.y);
      ctx.fillStyle = '#233d35ef';
      ctx.fillRect(x - 10 * pixels, y - 42 * pixels, 20 * pixels, 16 * pixels);
      ctx.font = 'bold ' + Math.round(11 * pixels) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff0ba';
      ctx.fillText('E', x, y - 34 * pixels);
    }
    return { left, top, scale };
  }

  function mapTransform(canvas, world, camera) {
    const { width, height } = canvas;
    const pixels = density(canvas);
    const bounds = world.campusBounds;
    const padding = overviewPadding * pixels;
    const fit = Math.min(
      Math.max(1, width - 2 * padding) / (bounds.right - bounds.left),
      Math.max(1, height - 2 * padding) / (bounds.bottom - bounds.top),
    );
    const scale = fit * camera.zoom;
    return {
      scale,
      x: width / 2 - camera.centerX * scale,
      y: height / 2 - camera.centerY * scale,
    };
  }

  function drawCompass(ctx, width, pixels, northAngle) {
    const x = width - 33 * pixels;
    const y = 33 * pixels;
    const r = 23 * pixels;
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#163733ed';
    ctx.fill();
    ctx.rotate(northAngle);
    ctx.beginPath();
    ctx.moveTo(0, -13 * pixels);
    ctx.lineTo(5 * pixels, 4 * pixels);
    ctx.lineTo(0, 1 * pixels);
    ctx.lineTo(-5 * pixels, 4 * pixels);
    ctx.closePath();
    ctx.fillStyle = '#f8ddac';
    ctx.fill();
    ctx.restore();
    ctx.font = '600 ' + Math.round(11 * pixels) + 'px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fbf6de';
    ctx.fillText('北', x, y + 12 * pixels);
  }

  function drawMap(canvas, world, player, camera, details = {}) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const pixels = density(canvas);
    const terrainCanvas = getTerrain(world, details.season);
    const transform = mapTransform(canvas, world, camera);
    const { scale, x: ox, y: oy } = transform;
    const project = (x, y) => [ox + x * scale, oy + y * scale];
    ctx.fillStyle = '#b8c1a8';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(terrainCanvas, ox, oy, world.width * scale, world.height * scale);
    drawRoute(ctx, details.route || [], project, pixels);
    const font = Math.round((width / pixels < 540 ? 12 : 13) * pixels);
    const rank = camera.zoom >= 1.65 ? 3 : width / pixels > 520 ? 2 : 1;
    labelsAt(ctx, world.labels, project, width, height, pixels, font, rank, true);
    for (const landmark of details.landmarks || []) {
      const [lx, ly] = project(landmark.x, landmark.y);
      const selected = landmark.name === details.selected;
      ctx.beginPath();
      ctx.arc(lx, ly, (selected ? 7 : 4.5) * pixels, 0, 2 * Math.PI);
      ctx.fillStyle = selected ? '#ffe19a' : '#f4bd72';
      ctx.fill();
      ctx.strokeStyle = '#243c37';
      ctx.lineWidth = 2 * pixels;
      ctx.stroke();
    }
    if (details.selectedPoint) {
      const [lx, ly] = project(details.selectedPoint.x, details.selectedPoint.y);
      ctx.strokeStyle = '#ffdb8c';
      ctx.lineWidth = 2 * pixels;
      ctx.strokeRect(lx - 5 * pixels, ly - 5 * pixels, 10 * pixels, 10 * pixels);
    }
    const [x, y] = project(player.x, player.y);
    const r = 5 * pixels;
    ctx.beginPath();
    ctx.arc(x, y, r + 2 * pixels, 0, 2 * Math.PI);
    ctx.fillStyle = '#fffdf2';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = '#257a83';
    ctx.fill();
    drawCompass(ctx, width, pixels, world.northAngle);
    return transform;
  }

  function drawMini(canvas, world, player, season, landmarks = []) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const pixels = density(canvas);
    const terrain = getTerrain(world, season);
    const radius = Math.min(width, height) / 2 - 3 * pixels;
    const scale = radius / 68;
    const x = width / 2, y = height / 2;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#81957f';
    ctx.fill();
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(terrain, x - player.x * scale, y - player.y * scale, world.width * scale, world.height * scale);
    for (const marker of landmarks) {
      ctx.fillStyle = '#ffd68b';
      ctx.fillRect(x + (marker.x - player.x) * scale - 2 * pixels, y + (marker.y - player.y) * scale - 2 * pixels, 4 * pixels, 4 * pixels);
    }
    const angle = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[player.dir] || 0;
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -8 * pixels);
    ctx.lineTo(5 * pixels, 5 * pixels);
    ctx.lineTo(-5 * pixels, 5 * pixels);
    ctx.closePath();
    ctx.fillStyle = '#235663';
    ctx.fill();
    ctx.strokeStyle = '#fff0cc';
    ctx.lineWidth = 1.5 * pixels;
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#d7c694';
    ctx.lineWidth = 2 * pixels;
    ctx.stroke();
    ctx.font = 'bold ' + Math.round(10 * pixels) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#183b32';
    ctx.fillText('北', x + Math.sin(world.northAngle) * (radius - 9 * pixels), y - Math.cos(world.northAngle) * (radius - 9 * pixels));
  }

  function landmarkIllustration(world, landmark, season) {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    const footprint = world.buildings.find(building => building.name === landmark.name);
    const points = footprint?.points || [[landmark.x, landmark.y]];
    const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const viewWidth = Math.max(110, maxX - minX + 45, (maxY - minY + 45) * canvas.width / canvas.height);
    const viewHeight = viewWidth * canvas.height / canvas.width;
    const left = Math.max(0, Math.min(world.width - viewWidth, (minX + maxX - viewWidth) / 2));
    const top = Math.max(0, Math.min(world.height - viewHeight, (minY + maxY - viewHeight) / 2));
    const terrain = getTerrain(world, season);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(terrain,
      left * terrain.width / world.width, top * terrain.height / world.height,
      viewWidth * terrain.width / world.width, viewHeight * terrain.height / world.height,
      0, 0, canvas.width, canvas.height);
    if (footprint) {
      path(ctx, footprint.points.map(([x, y]) => [(x - left) * canvas.width / viewWidth, (y - top) * canvas.height / viewHeight]));
      ctx.lineJoin = 'round';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#f7cf7c';
      ctx.stroke();
    }
    return canvas.toDataURL('image/png');
  }

  window.PixelView = { drawScene, drawMap, drawMini, mapTransform, landmarkIllustration };
})();

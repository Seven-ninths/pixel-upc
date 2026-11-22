(() => {
  'use strict';

  const world = window.PixelCampusView;
  const view = window.PixelView;
  const byId = id => document.getElementById(id);
  const scene = byId('scene');
  const map = byId('full-map');
  const mapDialog = byId('map-dialog');
  const zoomIn = byId('zoom-in');
  const zoomOut = byId('zoom-out');
  const landmarkSelect = byId('landmark-select');
  const landmarkCard = byId('landmark-card');
  const walkStart = byId('walk-start');
  const mapTeleport = byId('map-teleport');
  const chatDialog = byId('chat-dialog');
  const photoDialog = byId('photo-dialog');
  const helpDialog = byId('help-dialog');
  const miniMap = byId('mini-map');
  const fullscreen = byId('fullscreen-button');
  const locationName = byId('location-name');
  const player = { ...world.spawn, dir: 'up', moving: false };
  const radius = world.geo.unitsPerMeter * 1.1;
  let sceneDirty = true;
  let travel = null;
  let navigator;
  let nearby = null;
  let arrival = null;
  let openedLandmark = null;
  let selectedPoint = null;
  let sceneProjection;
  let studentUi;
  let bikeActive = false;
  const landmarks = window.PixelLandmarks.flatMap(details => {
    const location = world.labels.find(label => label.name === details.name);
    return location ? [{ ...location, ...details }] : [];
  });
  const areas = [
    ['南门', '滨海入口'], ['荟萃广场', '生活区'], ['体育馆', '文体区'],
    ['子元广场', '教学区'], ['讲堂群', '教学区'], ['图书馆东馆', '东馆一带'],
  ].flatMap(([name, area]) => {
    const label = world.labels.find(item => item.name === name);
    return label ? [{ ...label, area }] : [];
  });
  for (const landmark of landmarks) landmarkSelect.add(new Option(landmark.name, landmark.name));

  function contains(points, x, y) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [ax, ay] = points[j];
      const [bx, by] = points[i];
      if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) inside = !inside;
    }
    return inside;
  }

  function outline(points) {
    const edges = [];
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    for (let i = 0; i < points.length; i++) {
      const [x, y] = points.at(i - 1);
      const dx = points[i][0] - x, dy = points[i][1] - y;
      const lengthSquared = dx * dx + dy * dy;
      if (lengthSquared) edges.push({ x, y, dx, dy, lengthSquared });
    }
    return {
      points, edges,
      left: Math.min(...xs), top: Math.min(...ys),
      right: Math.max(...xs), bottom: Math.max(...ys),
    };
  }

  const campusBoundary = outline(world.boundary);
  const obstacles = [
    ...world.buildings.filter(building => building.kind !== 'gate' && !building.walkable),
    ...world.areas.filter(area => area.kind === 'water' || area.solid),
  ].map(feature => ({ ...outline(feature.points), name: feature.name }));

  function enclosing(shape, x, y, margin) {
    return x >= shape.left - margin && x <= shape.right + margin &&
      y >= shape.top - margin && y <= shape.bottom + margin;
  }

  function closestEdge(shape, x, y) {
    let distance = Infinity;
    let closestX, closestY, closest;
    for (const edge of shape.edges) {
      const t = Math.max(0, Math.min(1, ((x - edge.x) * edge.dx + (y - edge.y) * edge.dy) / edge.lengthSquared));
      const edgeX = edge.x + t * edge.dx, edgeY = edge.y + t * edge.dy;
      const separation = (x - edgeX) ** 2 + (y - edgeY) ** 2;
      if (separation < distance) {
        distance = separation;
        closestX = edgeX;
        closestY = edgeY;
        closest = edge;
      }
    }
    return { x: closestX, y: closestY, distance, edge: closest };
  }

  function collisionAt(x, y) {
    if (!contains(campusBoundary.points, x, y)) return campusBoundary;
    for (const obstacle of obstacles) {
      if (!enclosing(obstacle, x, y, radius)) continue;
      if (contains(obstacle.points, x, y) || closestEdge(obstacle, x, y).distance < radius ** 2) return obstacle;
    }
    return null;
  }

  function blocked(x, y) {
    return Boolean(collisionAt(x, y));
  }

  function roadNavigator() {
    navigator ??= window.PixelNavigation.build(world, blocked);
    return navigator;
  }

  const activities = window.PixelActivities.create(world, blocked);
  const life = window.PixelLife.create(world, blocked, roadNavigator());
  const makeLandmarkTarget = landmark => ({
    landmark,
    footprints: obstacles.filter(shape => shape.name === landmark.name),
    approach: roadNavigator().landing(landmark),
  });
  const landmarkTargets = landmarks.map(makeLandmarkTarget);
  const studentTargets = new Map();
  const seasonNames = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
  const modalOpen = () => mapDialog.open || chatDialog.open || photoDialog.open || helpDialog.open || studentUi?.open;

  function visitSouthGate() {
    stopTravel();
    arrival = null;
    nearby = null;
    showLandmark(null);
    Object.assign(player, world.spawn, { dir: 'up', moving: false });
    activities.resetPosition?.(player);
    sceneDirty = true;
    updateLocation();
  }

  function updateLocation() {
    let closest;
    let nearest = world.width * 0.061;
    for (const label of world.labels) {
      const distance = Math.hypot(label.x - player.x, label.y - player.y);
      if (distance < nearest) {
        closest = label;
        nearest = distance;
      }
    }
    const nearestLandmark = findLandmark(player);
    const name = nearestLandmark?.name || closest?.name || '唐岛湾校区';
    if (name !== locationName.textContent) locationName.textContent = name;
    if (openedLandmark) {
      byId('landmark-student-action').hidden = !studentUi?.availableAt(openedLandmark.name) || !studentIsNear(openedLandmark.name);
    }
    if (nearestLandmark === nearby) return;
    nearby = nearestLandmark;
    if (nearby) activities.visit(nearby.name);
  }

  function proximity(point, { landmark, footprints, approach }) {
    let score = approach ? Math.hypot(point.x - approach.x, point.y - approach.y) / 8 : Infinity;
    if (footprints.length) {
      for (const shape of footprints) {
        if (!enclosing(shape, point.x, point.y, 6)) continue;
        score = Math.min(score, Math.sqrt(closestEdge(shape, point.x, point.y).distance) / 6);
      }
    } else {
      score = Math.min(score, Math.hypot(point.x - landmark.x, point.y - landmark.y) / 18);
    }
    return score;
  }

  function findTarget(point, targets) {
    let closest = null;
    let best = 1;
    for (const target of targets) {
      const score = proximity(point, target);
      if (score < best) {
        best = score;
        closest = target.landmark;
      }
    }
    return closest;
  }

  function findLandmark(point) {
    if (arrival && Math.hypot(point.x - arrival.x, point.y - arrival.y) < 12) return arrival.landmark;
    if (arrival && point === player) arrival = null;
    return findTarget(point, landmarkTargets);
  }

  function studentIsNear(name) {
    const target = studentTargets.get(name) || landmarkTargets.find(item => item.landmark.name === name);
    return Boolean(target && proximity(player, target) < 1);
  }

  function studentPlace() {
    return findTarget(player, studentTargets.values())?.name || findLandmark(player)?.name || '';
  }

  function arriveAt(landmark) {
    arrival = { x: player.x, y: player.y, landmark };
    nearby = landmark;
    activities.visit(landmark.name);
    locationName.textContent = landmark.name;
  }

  function linksFor(sources) {
    return sources.map(source => {
      const link = document.createElement('a');
      link.href = source.url;
      link.textContent = source.name;
      link.target = '_blank';
      link.rel = 'noopener';
      return link;
    });
  }

  function showLandmark(landmark) {
    openedLandmark = landmark;
    landmarkCard.hidden = !landmark;
    if (!landmark) return;
    byId('landmark-student-action').hidden = !studentUi?.availableAt(landmark.name) || !studentIsNear(landmark.name);
    activities.visit(landmark.name);
    byId('landmark-name').textContent = landmark.name;
    byId('landmark-summary').textContent = landmark.summary;
    byId('landmark-sources').replaceChildren(...linksFor(landmark.sources));
    const details = (landmark.details || []).map(detail => {
      const paragraph = document.createElement('p');
      paragraph.textContent = detail;
      return paragraph;
    });
    byId('landmark-details').replaceChildren(...details);
    updateLandmarkImage(landmark);
    byId('landmark-content').scrollTop = 0;
  }

  function updateLandmarkImage(landmark) {
    const image = byId('landmark-image');
    const credit = byId('landmark-image-credit');
    const showIllustration = () => {
      if (openedLandmark !== landmark) return;
      image.onerror = null;
      image.alt = landmark.name + '的校区地图局部示意';
      image.src = view.landmarkIllustration(world, landmark, activities.season);
      credit.href = 'https://www.openstreetmap.org/copyright';
      credit.textContent = '校区地图局部示意 · © OpenStreetMap 贡献者';
    };
    image.hidden = false;
    credit.hidden = false;
    const photo = landmark.image;
    if (!photo?.src) {
      showIllustration();
      return;
    }
    function showPhoto() {
      if (openedLandmark !== landmark) return;
      image.onerror = showIllustration;
      image.alt = photo.alt || landmark.name;
      image.src = photo.src;
      credit.href = photo.source || landmark.sources[0]?.url;
      credit.textContent = photo.credit || '图片来源';
    }
    if (/^https?:\/\//.test(photo.src)) {
      showIllustration();
      const pendingPhoto = new Image();
      pendingPhoto.onload = showPhoto;
      pendingPhoto.src = photo.src;
    } else {
      showPhoto();
    }
  }

  function stopTravel() {
    if (!travel) return;
    travel = null;
    sceneDirty = true;
    byId('walk-bar').hidden = true;
  }

  function startTravel() {
    const target = selectedDestination();
    const message = byId('map-route-message');
    if (!target) return;
    if (!travelTo(target)) {
      message.textContent = '这里暂时没有查到到达该地标的地面步行路线。';
      return;
    }
    message.textContent = '';
    mapDialog.close();
  }

  function travelTo(target) {
    const route = roadNavigator().route(player, target);
    if (!route?.length) return false;
    byId('status').textContent = '';
    travel = { target, route, next: 0 };
    arrival = null;
    nearby = null;
    showLandmark(null);
    byId('walk-destination').textContent = '沿路前往 ' + target.name;
    byId('walk-bar').hidden = false;
    clearInput();
    sceneDirty = true;
    return true;
  }

  function studentRoute(name) {
    const target = landmarks.find(landmark => landmark.name === name) || world.labels.find(label => label.name === name);
    return Boolean(target && travelTo(target));
  }

  function studentHome(name) {
    const destination = studentTargets.get(name)?.approach;
    if (!destination) return;
    stopTravel();
    arrival = null;
    nearby = null;
    Object.assign(player, destination, { dir: 'up', moving: false });
    activities.resetPosition?.(player);
    sceneDirty = true;
    updateLocation();
  }

  function restoreStudentPosition(position) {
    if (!position || blocked(position.x, position.y)) return;
    Object.assign(player, position, { moving: false });
    activities.resetPosition?.(player);
  }

  function selectedDestination() {
    return landmarks.find(landmark => landmark.name === landmarkSelect.value) || selectedPoint;
  }

  function teleport() {
    const target = selectedDestination();
    if (!target) return;
    const destination = roadNavigator().landing(target);
    if (!destination) {
      byId('map-route-message').textContent = '这个位置附近没有可落脚的校内道路。';
      return;
    }
    stopTravel();
    clearInput();
    Object.assign(player, destination, { dir: 'up', moving: false });
    activities.resetPosition?.(player);
    mapDialog.close();
    showLandmark(null);
    nearby = null;
    arrival = null;
    if (target.summary) arriveAt(target);
    else updateLocation();
    sceneDirty = true;
    byId('status').textContent = '已到达' + (target.summary ? target.name + '附近。' : '所选地点附近。');
  }

  function routeLine() {
    return travel ? [player, ...travel.route.slice(travel.next)] : [];
  }

  const pressed = new Set();
  const touching = new Map();
  const joystick = byId('joystick');
  const joystickThumb = byId('joystick-thumb');
  const stick = { pointer: null, x: 0, y: 0 };
  const movement = new Map([
    ['w', 'up'], ['arrowup', 'up'], ['a', 'left'], ['arrowleft', 'left'],
    ['s', 'down'], ['arrowdown', 'down'], ['d', 'right'], ['arrowright', 'right'],
  ]);

  function clearInput() {
    pressed.clear();
    touching.clear();
    resetStick();
  }

  function resetStick() {
    Object.assign(stick, { pointer: null, x: 0, y: 0 });
    if (joystickThumb) joystickThumb.style.transform = '';
  }

  function pushStick(event) {
    const rect = joystick.getBoundingClientRect();
    const range = rect.width * 0.31;
    const x = (event.clientX - rect.left - rect.width / 2) / range;
    const y = (event.clientY - rect.top - rect.height / 2) / range;
    const length = Math.hypot(x, y);
    stick.x = length > 0.15 ? x / Math.max(1, length) : 0;
    stick.y = length > 0.15 ? y / Math.max(1, length) : 0;
    if (joystickThumb) joystickThumb.style.transform = 'translate(' + stick.x * range + 'px,' + stick.y * range + 'px)';
  }

  joystick?.addEventListener('pointerdown', event => {
    if (event.button !== 0 || stick.pointer !== null) return;
    event.preventDefault();
    stopTravel();
    stick.pointer = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    pushStick(event);
  });
  joystick?.addEventListener('pointermove', event => {
    if (stick.pointer === event.pointerId) pushStick(event);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    joystick?.addEventListener(type, event => {
      if (stick.pointer === event.pointerId) resetStick();
    });
  }

  const bounds = world.campusBounds;
  const mapHome = {
    zoom: 1,
    centerX: (bounds.left + bounds.right) / 2,
    centerY: (bounds.top + bounds.bottom) / 2,
  };
  const mapCamera = { ...mapHome };
  const mapPointers = new Map();
  const zoomMaximum = 4;
  let mapProjection;
  let tapOrigin;
  let isDragging = false;

  function fitBackingStore(canvas) {
    const pixels = Math.min(devicePixelRatio || 1, 2.5);
    const width = Math.max(1, Math.round(canvas.clientWidth * pixels));
    const height = Math.max(1, Math.round(canvas.clientHeight * pixels));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }

  function redrawMap() {
    if (!mapDialog.open) return;
    fitBackingStore(map);
    mapProjection = view.drawMap(map, world, player, mapCamera, {
      landmarks, selected: landmarkSelect.value, selectedPoint, route: routeLine(), season: activities.season,
    });
    zoomOut.disabled = mapCamera.zoom <= mapHome.zoom;
    zoomIn.disabled = mapCamera.zoom >= zoomMaximum;
  }

  function canvasPoint({ x, y }) {
    const rect = map.getBoundingClientRect();
    return {
      x: (x - rect.left) * map.width / rect.width,
      y: (y - rect.top) * map.height / rect.height,
    };
  }

  function moveMap(multiplier, from = { x: map.width / 2, y: map.height / 2 }, to = from) {
    if (!mapProjection) return;
    const location = {
      x: (from.x - mapProjection.x) / mapProjection.scale,
      y: (from.y - mapProjection.y) / mapProjection.scale,
    };
    mapCamera.zoom = Math.min(zoomMaximum, Math.max(mapHome.zoom, mapCamera.zoom * multiplier));
    const { scale } = view.mapTransform(map, world, mapCamera);
    mapCamera.centerX = Math.min(bounds.right, Math.max(bounds.left, location.x - (to.x - map.width / 2) / scale));
    mapCamera.centerY = Math.min(bounds.bottom, Math.max(bounds.top, location.y - (to.y - map.height / 2) / scale));
    redrawMap();
  }

  function resetMap() {
    Object.assign(mapCamera, mapHome);
    redrawMap();
  }

  function selectLandmark(name) {
    selectedPoint = null;
    landmarkSelect.value = name;
    walkStart.disabled = !name;
    mapTeleport.disabled = !name;
    byId('map-route-message').textContent = '';
    redrawMap();
  }

  function pickLandmark(position) {
    const point = canvasPoint(position);
    let nearest;
    let distance = 28 * map.width / map.clientWidth;
    for (const landmark of landmarks) {
      const separation = Math.hypot(
        landmark.x * mapProjection.scale + mapProjection.x - point.x,
        landmark.y * mapProjection.scale + mapProjection.y - point.y,
      );
      if (separation < distance) {
        distance = separation;
        nearest = landmark;
      }
    }
    if (nearest) {
      selectLandmark(nearest.name);
      return;
    }
    const x = (point.x - mapProjection.x) / mapProjection.scale;
    const y = (point.y - mapProjection.y) / mapProjection.scale;
    if (!contains(world.boundary, x, y)) return;
    selectedPoint = { x, y, name: '地图落点' };
    landmarkSelect.value = '';
    walkStart.disabled = false;
    mapTeleport.disabled = false;
    byId('map-route-message').textContent = '已选地图落点';
    redrawMap();
  }

  landmarkSelect.addEventListener('change', () => selectLandmark(landmarkSelect.value));
  walkStart.addEventListener('click', startTravel);
  mapTeleport.addEventListener('click', teleport);
  byId('walk-stop').addEventListener('click', stopTravel);
  byId('landmark-close').addEventListener('click', () => showLandmark(null));

  zoomIn.addEventListener('click', () => moveMap(1.35));
  zoomOut.addEventListener('click', () => moveMap(1 / 1.35));
  byId('zoom-reset').addEventListener('click', resetMap);
  map.addEventListener('wheel', event => {
    event.preventDefault();
    const delta = event.deltaY * ([1, 16, map.clientHeight][event.deltaMode] || 1);
    moveMap(Math.exp(-delta * 0.0025), canvasPoint({ x: event.clientX, y: event.clientY }));
  }, { passive: false });

  function mapGesture(points) {
    const [first, second] = points;
    if (!second) return { center: canvasPoint(first), length: 1 };
    return {
      center: canvasPoint({ x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }),
      length: Math.max(1, Math.hypot(first.x - second.x, first.y - second.y)),
    };
  }

  map.addEventListener('pointerdown', event => {
    if (event.button !== 0 || mapPointers.size >= 2) return;
    map.setPointerCapture(event.pointerId);
    if (!mapPointers.size) {
      tapOrigin = { x: event.clientX, y: event.clientY };
      isDragging = false;
    } else isDragging = true;
    mapPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  });
  map.addEventListener('pointermove', event => {
    if (!mapPointers.has(event.pointerId)) return;
    if (!isDragging && Math.hypot(event.clientX - tapOrigin.x, event.clientY - tapOrigin.y) < 5) return;
    isDragging = true;
    map.classList.add('is-panning');
    const before = mapGesture(mapPointers.values());
    mapPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const after = mapGesture(mapPointers.values());
    moveMap(after.length / before.length, before.center, after.center);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    map.addEventListener(type, event => {
      if (type === 'pointerup' && mapPointers.has(event.pointerId) && !isDragging) {
        pickLandmark({ x: event.clientX, y: event.clientY });
      }
      mapPointers.delete(event.pointerId);
      if (!mapPointers.size) map.classList.remove('is-panning');
    });
  }
  mapDialog.addEventListener('close', () => {
    mapPointers.clear();
    map.classList.remove('is-panning');
  });
  mapDialog.addEventListener('keydown', event => {
    if (event.key === '+' || event.key === '=' || event.key === '-' || event.key === '0') {
      event.preventDefault();
      if (event.key === '0') resetMap();
      else moveMap(event.key === '-' ? 1 / 1.35 : 1.35);
    }
  });
  map.addEventListener('keydown', event => {
    const offset = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[event.key];
    if (!offset) return;
    event.preventDefault();
    const center = { x: map.width / 2, y: map.height / 2 };
    const distance = Math.min(map.width, map.height) / 12;
    moveMap(1, center, { x: center.x + offset[0] * distance, y: center.y + offset[1] * distance });
  });

  function toggleMap() {
    clearInput();
    if (mapDialog.open) {
      mapDialog.close();
      return;
    }
    mapDialog.showModal();
    redrawMap();
  }

  const interactionButton = byId('interact-button');
  const interactionLabel = byId('interact-label');
  const clockTime = byId('clock-time');
  const clockPhase = byId('clock-phase');
  const clockJump = byId('clock-jump');
  const seasonButtons = [...document.querySelectorAll('[data-season]')];
  const chatOptions = byId('chat-options');
  let progressKey = '';

  function closestTo(point, entries, limit) {
    let closest = null;
    for (const item of entries) {
      const distance = Math.hypot(item.x - point.x, item.y - point.y);
      if (distance < limit) {
        closest = item;
        limit = distance;
      }
    }
    return closest;
  }

  function interactionTarget() {
    const student = closestTo(player, life.students, 12.5);
    const cat = closestTo(player, activities.cats, 8);
    const sign = findLandmark(player);
    const gate = landmarks.find(landmark => landmark.name === '南门');
    const gateCheck = activities.progress.find(item => item.id === 'gate');
    const atGate = gate && gateCheck && !gateCheck.done && Math.hypot(gate.x - player.x, gate.y - player.y) < 25;
    const venue = studentUi?.active ? findTarget(player, studentTargets.values()) : null;
    return { student, cat, sign, gate: atGate, venue };
  }

  function renderChat(title, text, topics) {
    byId('chat-title').textContent = title;
    byId('chat-text').textContent = text;
    chatOptions.replaceChildren(...topics.map(topic => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = topic.label;
      button.addEventListener('click', () => {
        if (topic.action) {
          topic.action();
          return;
        }
        byId('chat-text').textContent = topic.reply;
        chatOptions.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-pressed', 'true');
      });
      button.setAttribute('aria-pressed', 'false');
      return button;
    }));
  }

  function openChat(title, text, topics = []) {
    if (modalOpen()) return;
    stopTravel();
    clearInput();
    renderChat(title, text, topics);
    chatDialog.showModal();
  }

  function talk(student) {
    studentUi?.observe(student);
    const exchange = studentUi?.talk(student);
    if (exchange && !modalOpen()) {
      const caption = typeof student.destination === 'string' && student.destination
        ? (student.status || '在校园里活动') + ' · 去往' + student.destination
        : '';
      const title = exchange.dialogue.name || student.name;
      const present = dialogue => {
        const options = (dialogue.choices || []).map(choice => ({
          label: choice.label,
          action: () => {
            const response = studentUi.choose(exchange.peerId, choice.id);
            if (response) present(response);
          },
        }));
        renderChat(dialogue.name || title, (caption ? caption + '。\n' : '') + dialogue.text, options);
      };
      openChat(title, exchange.dialogue.text);
      present(exchange.dialogue);
      return;
    }
    if (studentUi?.active && typeof student.destination === 'string' && student.destination) {
      openChat(student.name, (student.status || '在校园里活动') + ' · 去往' + student.destination, student.topics);
      return;
    }
    openChat(student.name, student.greeting || '你好，我在校园里走走。你想聊什么？', student.topics);
  }

  function interact() {
    if (modalOpen()) return;
    const target = interactionTarget();
    if (target.gate || (target.cat && !target.cat.found)) {
      const result = activities.interact(player);
      if (result) {
        openChat(result.title, result.text);
        return;
      }
    }
    if (target.venue) {
      if (target.sign?.name === target.venue.name && openedLandmark?.name !== target.venue.name) {
        stopTravel();
        clearInput();
        showLandmark(target.sign);
        byId('status').textContent = '点右侧「校园活动」，也可以再按 E 进入。';
      } else {
        studentUi.openLocation(target.venue.name);
      }
      return;
    }
    if (target.sign) {
      stopTravel();
      clearInput();
      showLandmark(openedLandmark === target.sign ? null : target.sign);
      return;
    }
    if (target.student) {
      talk(target.student);
      return;
    }
    const result = activities.interact(player);
    if (result) {
      openChat(result.title, result.text);
    } else {
      byId('status').textContent = '走近同学、校园猫或地标后即可互动。';
    }
  }

  function formattedTime() {
    const minutes = Math.floor(life.minutes);
    return [Math.floor(minutes / 60), minutes % 60].map(value => String(value).padStart(2, '0')).join(':');
  }

  function makePostcard() {
    if (modalOpen()) return;
    clearInput();
    const card = document.createElement('canvas');
    const width = 960, padding = 30, imageWidth = width - padding * 2, imageHeight = 500;
    card.width = width;
    card.height = 696;
    const ctx = card.getContext('2d');
    ctx.fillStyle = '#f5efdd';
    ctx.fillRect(0, 0, card.width, card.height);
    const scale = Math.min(scene.width / imageWidth, scene.height / imageHeight);
    const widthIn = imageWidth * scale, heightIn = imageHeight * scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(scene, (scene.width - widthIn) / 2, (scene.height - heightIn) / 2, widthIn, heightIn,
      padding, 25, imageWidth, imageHeight);
    ctx.fillStyle = '#1b3d39';
    ctx.font = '700 32px "Microsoft YaHei", sans-serif';
    ctx.fillText('唐岛湾 · ' + locationName.textContent, padding, 576);
    ctx.font = '19px "Microsoft YaHei", sans-serif';
    ctx.fillText('中国石油大学（华东）　' + seasonNames[activities.season] + ' · ' + formattedTime(), padding, 618);
    ctx.font = '14px sans-serif';
    ctx.fillText('像素 UPC　·　© OpenStreetMap 贡献者　openstreetmap.org/copyright', padding, 661);
    ctx.strokeStyle = '#9d6746';
    ctx.lineWidth = 2;
    ctx.strokeRect(814, 548, 108, 76);
    ctx.font = '700 16px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#9d6746';
    ctx.fillText('唐岛湾漫游', 828, 591);
    const url = card.toDataURL('image/png');
    byId('photo-preview').src = url;
    const save = byId('photo-save');
    save.href = url;
    save.download = '像素UPC-' + locationName.textContent + '.png';
    photoDialog.showModal();
  }

  function updateCampusHud() {
    clockTime.textContent = formattedTime();
    clockPhase.textContent = life.phase || (life.breakActive ? '课间' : '平常时段');
    const progress = activities.progress;
    const key = progress.map(item => item.done ? '1' : '0').join('');
    if (key !== progressKey) {
      progressKey = key;
      const entries = progress.map(item => {
        const li = document.createElement('li');
        li.classList.toggle('is-done', item.done);
        li.textContent = (item.done ? '✓ ' : '○ ') + item.label;
        return li;
      });
      byId('campus-checklist').replaceChildren(...entries);
      byId('progress-count').textContent = progress.filter(item => item.done).length + '/' + progress.length;
    }
    byId('cat-count').textContent = activities.cats.filter(cat => cat.found).length + '/' + activities.cats.length;
    byId('axis-distance').textContent = Math.floor(activities.distance) + ' / 120 米';
    const { student, cat, sign, gate, venue } = interactionTarget();
    const text = gate ? '南门报到' : cat && !cat.found ? '认识校园猫' : venue ? '互动 · ' + venue.name : sign ? '查看地标' : student ? '和' + student.name + '聊天' : '互动';
    if (interactionLabel) interactionLabel.textContent = text;
    interactionButton.classList.toggle('can-interact', Boolean(gate || student || cat || sign || venue));
    if (miniMap.clientWidth > 0 && miniMap.clientHeight > 0) {
      fitBackingStore(miniMap);
      view.drawMini(miniMap, world, player, activities.season, landmarks);
    }
    const zone = byId('mini-region');
    const position = byId('mini-position');
    if (zone) zone.textContent = closestTo(player, areas, Infinity)?.area || '校区';
    if (position) position.textContent = locationName.textContent + ' · ' + Math.round(player.x) + ', ' + Math.round(player.y);
  }

  function changeSeason(season) {
    if (!Object.hasOwn(seasonNames, season)) return;
    activities.setSeason(season);
    if (studentUi?.active) life.setWeather?.(season === 'winter' ? 'snow' : 'clear');
    for (const button of seasonButtons) button.setAttribute('aria-pressed', String(button.dataset.season === season));
    sceneDirty = true;
    updateCampusHud();
    redrawMap();
  }

  interactionButton.addEventListener('click', interact);
  byId('landmark-student-action').addEventListener('click', () => {
    if (openedLandmark && studentIsNear(openedLandmark.name)) studentUi.openLocation(openedLandmark.name);
  });
  byId('chat-close').addEventListener('click', () => chatDialog.close());
  byId('photo-open').addEventListener('click', makePostcard);
  byId('photo-close').addEventListener('click', () => photoDialog.close());
  byId('help-open').addEventListener('click', () => {
    clearInput();
    helpDialog.showModal();
  });
  byId('help-close').addEventListener('click', () => helpDialog.close());
  clockJump?.addEventListener('change', () => {
    if (!clockJump.value) return;
    life.seek(Number(clockJump.value));
    clockJump.value = '';
    updateCampusHud();
    sceneDirty = true;
  });
  for (const button of seasonButtons) button.addEventListener('click', () => changeSeason(button.dataset.season));
  byId('mini-panel').addEventListener('toggle', updateCampusHud);
  scene.addEventListener('click', event => {
    if (!sceneProjection || modalOpen()) return;
    const rect = scene.getBoundingClientRect();
    const x = (event.clientX - rect.left) * scene.width / rect.width;
    const y = (event.clientY - rect.top) * scene.height / rect.height;
    const point = { x: sceneProjection.left + x / sceneProjection.scale, y: sceneProjection.top + y / sceneProjection.scale };
    const student = closestTo({ x: point.x, y: point.y + 2 }, life.students, 3.5);
    if (student && Math.hypot(student.x - player.x, student.y - player.y) < 12.5) talk(student);
  });

  async function toggleFullscreen() {
    const status = byId('status');
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if (status) {
        status.textContent = '已铺满浏览器窗口。可通过浏览器菜单进入全屏。';
      }
    } catch {
      if (status) status.textContent = '已铺满浏览器窗口。可通过浏览器菜单进入全屏。';
    }
  }

  if (fullscreen) {
    fullscreen.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', () => {
      const active = Boolean(document.fullscreenElement);
      fullscreen.setAttribute('aria-pressed', String(active));
      fullscreen.setAttribute('aria-label', active ? '退出全屏' : '进入全屏');
      const text = fullscreen.querySelector('[data-fullscreen-label]');
      if (text) text.textContent = active ? '退出全屏' : '全屏';
    });
  }

  window.addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target.matches?.('input, textarea, select') || (modalOpen() && !mapDialog.open)) return;
    const key = event.key.toLowerCase();
    if (!mapDialog.open && key === 'escape' && openedLandmark) {
      event.preventDefault();
      showLandmark(null);
      return;
    }
    if (!mapDialog.open && key === 'escape' && travel) {
      event.preventDefault();
      stopTravel();
      return;
    }
    if (key === 'm' || (!mapDialog.open && (key === 'f' || key === 'r'))) {
      event.preventDefault();
      if (!event.repeat) {
        if (key === 'm') toggleMap();
        if (key === 'f') toggleFullscreen();
        if (key === 'r') visitSouthGate();
      }
    } else if (!mapDialog.open && (movement.has(key) || key === 'shift')) {
      event.preventDefault();
      if (movement.has(key)) stopTravel();
      pressed.add(key);
    } else if (!mapDialog.open && (key === 'e' || key === 'p')) {
      event.preventDefault();
      if (!event.repeat) {
        if (key === 'e') interact();
        else makePostcard();
      }
    }
  });
  window.addEventListener('keyup', event => pressed.delete(event.key.toLowerCase()));
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
  for (const button of document.querySelectorAll('[data-move]')) {
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      stopTravel();
      button.setPointerCapture(event.pointerId);
      touching.set(event.pointerId, button.dataset.move);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(type, event => touching.delete(event.pointerId));
    }
  }

  byId('map-toggle').addEventListener('click', toggleMap);
  byId('map-close').addEventListener('click', () => mapDialog.close());
  (byId('reset') || byId('home')).addEventListener('click', visitSouthGate);
  const sources = byId('sources');
  if (sources && world.sources?.length) {
    sources.replaceChildren(...linksFor(world.sources));
  }

  function resize() {
    fitBackingStore(scene);
    sceneDirty = true;
    redrawMap();
  }

  function slideStep(dx, dy) {
    const hit = collisionAt(player.x + dx, player.y + dy);
    if (!hit) return { x: player.x + dx, y: player.y + dy };
    const contact = closestEdge(hit, player.x, player.y);
    const normalX = player.x - contact.x, normalY = player.y - contact.y;
    const distance = Math.hypot(normalX, normalY);
    const edgeLength = Math.sqrt(contact.edge.lengthSquared);
    const tx = distance > 1e-6 ? -normalY / distance : contact.edge.dx / edgeLength;
    const ty = distance > 1e-6 ? normalX / distance : contact.edge.dy / edgeLength;
    const tangentSpeed = dx * tx + dy * ty;
    const candidates = [[tx * tangentSpeed, ty * tangentSpeed], [dx, 0], [0, dy]];
    let result = null;
    let best = 1e-8;
    for (const [mx, my] of candidates) {
      for (const fraction of [1, 0.5]) {
        const score = (mx * dx + my * dy) * fraction;
        if (score <= best) break;
        const x = player.x + mx * fraction, y = player.y + my * fraction;
        if (blocked(x, y)) continue;
        result = { x, y };
        best = score;
        break;
      }
    }
    return result;
  }

  function move(elapsed, walkedPoints) {
    const held = new Set([...Array.from(pressed, key => movement.get(key)), ...touching.values()]);
    const keyX = Number(held.has('right')) - Number(held.has('left'));
    const keyY = Number(held.has('down')) - Number(held.has('up'));
    const keyboard = keyX !== 0 || keyY !== 0;
    const dx = keyboard ? keyX : stick.x;
    const dy = keyboard ? keyY : stick.y;
    if (!dx && !dy) return;
    player.dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    const strength = Math.hypot(dx, dy);
    const fast = pressed.has('shift') || (!keyboard && strength > 0.83);
    const pace = bikeActive ? (fast ? 0.115 : 0.090) : (fast ? 0.070 : 0.035);
    const distance = world.width * pace * elapsed * Math.min(1, strength);
    const steps = Math.max(1, Math.ceil(distance / radius));
    const step = distance / strength / steps;
    for (let i = 0; i < steps; i++) {
      const position = slideStep(dx * step, dy * step);
      if (!position || step === 0) break;
      Object.assign(player, position, { moving: true });
      walkedPoints.push(position);
    }
  }

  function followRoute(elapsed, walkedPoints) {
    let remaining = world.width * (bikeActive ? 0.09 : 0.047) * elapsed;
    while (remaining > 0 && travel.next < travel.route.length) {
      const point = travel.route[travel.next];
      const dx = point.x - player.x, dy = point.y - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 0.001) {
        travel.next++;
        continue;
      }
      const step = Math.min(remaining, distance, radius);
      const x = player.x + dx / distance * step;
      const y = player.y + dy / distance * step;
      if (blocked(x, y)) {
        stopTravel();
        byId('status').textContent = '已在道路障碍前停下。可以手动移动或重新选择地标。';
        return;
      }
      player.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
      Object.assign(player, { x, y, moving: true });
      walkedPoints.push({ x, y });
      remaining -= step;
      if (step === distance) travel.next++;
    }
    if (travel.next >= travel.route.length) {
      const target = travel.target;
      stopTravel();
      if (target.summary) {
        arriveAt(target);
        byId('status').textContent = '已到达' + target.name + '附近。按 E 互动。';
      }
      else {
        arrival = null;
        nearby = null;
        updateLocation();
        if (studentUi?.active && studentTargets.has(target.name)) {
          byId('status').textContent = '已到达' + target.name + '附近。按 E 互动。';
        }
      }
    }
  }

  let lastFrame;
  let lastLocation = -Infinity;
  function frame(now) {
    const elapsed = lastFrame === undefined ? 0 : Math.min(0.045, (now - lastFrame) / 1000);
    lastFrame = now;
    const wasMoving = player.moving;
    const previousDirection = player.dir;
    player.moving = false;
    if (!modalOpen()) {
      const walkedPoints = [];
      if (travel) followRoute(elapsed, walkedPoints);
      else move(elapsed, walkedPoints);
      life.update(elapsed);
      life.setListener?.(player);
      studentUi.tick();
      activities.update(player, elapsed, walkedPoints);
    }
    if (!modalOpen() || sceneDirty || player.moving || wasMoving || previousDirection !== player.dir) {
      const { student, cat, sign, gate } = interactionTarget();
      sceneProjection = view.drawScene(scene, world, player, now, routeLine(), {
        vehicles: life.vehicles, students: life.students, cats: activities.cats,
        season: activities.season, minutes: life.minutes, weather: studentUi.active ? life.weather : undefined,
        highlight: gate ? player : cat && !cat.found ? cat : sign ? player : student || cat,
      });
      sceneDirty = false;
    }
    if (now - lastLocation > 180) {
      updateLocation();
      updateCampusHud();
      lastLocation = now;
    }
    requestAnimationFrame(frame);
  }

  const observer = new ResizeObserver(resize);
  studentUi = window.PixelStudentUI.create({
    life,
    ready: () => !modalOpen(),
    beforeOpen: () => { stopTravel(); clearInput(); },
    route: studentRoute,
    goHome: studentHome,
    isNear: studentIsNear,
    here: studentPlace,
    onChange(profile, bike) {
      Object.assign(player, { color: profile.shirt, hair: profile.hair, skin: profile.skin, cycling: bike });
      bikeActive = bike;
      sceneDirty = true;
    },
    markStatus: text => { byId('status').textContent = text; },
    getPosition: () => ({ x: player.x, y: player.y, dir: player.dir }),
    restorePosition: restoreStudentPosition,
  });
  for (const name of studentUi.locationNames) {
    const location = world.labels.find(item => item.name === name);
    if (location) studentTargets.set(name, makeLandmarkTarget(location));
  }
  studentUi.initialize();
  window.addEventListener('pagehide', studentUi.save);
  observer.observe(scene);
  observer.observe(byId('map-viewport'));
  window.addEventListener('resize', resize);
  resize();
  updateLocation();
  changeSeason(activities.season);
  requestAnimationFrame(frame);
})();

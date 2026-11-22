(() => {
  'use strict';

  const START_MINUTE = 8 * 60 + 43;
  const MINUTES_PER_SECOND = 1 / 1.2;
  const DAY_MINUTES = 24 * 60;
  const lessons = [
    [480, 525], [530, 575], [595, 640], [645, 690], [695, 740], [840, 885],
    [890, 935], [955, 1000], [1005, 1050], [1140, 1185], [1190, 1235], [1240, 1285],
  ];

  const places = {
    classes: ['南教楼', '讲堂群', '文理楼', '工科楼A'],
    homes: ['1号学生公寓', '8号学生公寓', '13号学生公寓', '19号学生公寓', '研究生公寓2号楼'],
    meals: ['唐岛湾餐厅', '荟萃苑餐厅', '玉兰苑餐厅', '学苑餐厅'],
    reading: ['图书馆总馆', '图书馆东馆'],
    lounge: ['子元广场', '荟萃广场', '求索园', '创造太阳'],
    sports: ['体育馆', '训练馆'],
  };
  const weathers = new Set(['clear', 'rain', 'snow', 'wind', 'fog']);
  const libraryCapacity = 5;
  const classroomCapacity = 16;
  const mealTime = 740;
  const afternoon = 840;

  const names = [
    '林同学', '阿岚', '晓齐', '小澄', '周同学', '小满', '亦舟', '言溪', '江宁', '小郁', '阿遥', '思远',
    '小梁', '杜同学', '小池', '乔同学', '小北', '叶同学', '小何', '安然', '小裴', '知秋', '宋同学',
    '方同学', '山青', '文悦', '小白', '小喻', '小路', '季同学', '云帆', '小罗', '听雨', '阿然',
    '小姜', '小顾', '东东', '子清', '苏同学', '小陶', '飞飞', '陈同学',
  ];
  const clothes = ['#4d8490', '#9b5976', '#bc7c46', '#6077ae', '#5d8a65', '#a25b51', '#81698e'];
  const carColors = ['#a9c2d1', '#dfd1ac', '#ba744f', '#6b96a7', '#899c5e', '#c5ced3'];
  const motorRoads = new Set(['长江西路', '江山南路', '漓江西路', '太行山路']);

  const topicSets = [
    [ ['聊光华大道', '沿光华大道向校内走，就能遇到创造太阳雕塑。第一次来，可以拿它当方向标。'],
      ['推荐散步路线', '有空就往子元广场走走。树荫下适合放慢一点，我有时会带着书去坐会儿。'] ],
    [ ['聊图书馆', '总馆和东馆都在唐岛湾。我喜欢在东馆看窗外，读累了也能望一望海。'],
      ['问问课间', '这几分钟一出门就能碰见好几个同学。下一节有课的话，我会先往教室走。'] ],
    [ ['你要去哪儿？', '我去找同学。刚才约好了在南教楼附近碰面，一起去上课。'],
      ['聊聊校园', '我刚来时总记不住楼名，后来一边散步一边认路，很快就熟悉了。'] ],
    [ ['聊拍照', '我喜欢给同一个路口拍照。不同季节去看，叶子的颜色和光都不一样。'],
      ['问问餐厅', '我一般和室友约在唐岛湾餐厅附近。有空也会从教学区散步去荟萃苑。'] ],
  ];

  const wrap = (value, total) => ((value % total) + total) % total;

  function makeTrack(points) {
    const segments = [];
    let length = 0;
    for (let index = 1; index < points.length; index++) {
      const first = points[index - 1];
      const dx = points[index].x - first.x;
      const dy = points[index].y - first.y;
      const span = Math.hypot(dx, dy);
      if (span < 0.0001) continue;
      segments.push({ x: first.x, y: first.y, dx, dy, span, end: length + span });
      length += span;
    }
    return { segments, length };
  }

  function positionOn(track, distance, direction, entity = {}) {
    let left = 0;
    let right = track.segments.length - 1;
    while (left < right) {
      const middle = (left + right) >> 1;
      if (track.segments[middle].end > distance) right = middle;
      else left = middle + 1;
    }
    const segment = track.segments[left];
    const progress = 1 - (segment.end - distance) / segment.span;
    const dx = segment.dx * direction;
    const dy = segment.dy * direction;
    entity.x = segment.x + segment.dx * progress;
    entity.y = segment.y + segment.dy * progress;
    entity.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    entity.angle = Math.atan2(dy, dx);
    return entity;
  }

  function makePeople() {
    return Array.from({ length: 42 }, (_, index) => {
      const id = index + 1;
      return {
        id: 'student-' + id,
        name: names[index],
        color: clothes[index % clothes.length],
        greeting: ['嗨，今天也在校园里走走吗？', '你好！正好在路上遇见你。', '要聊几句吗？我还来得及。'][index % 3],
        topics: topicSets[index % topicSets.length].map(([label, reply]) => ({ label, reply })),
        phase: id * 67,
        speed: 10.5 + id % 7 * 0.64,
        preference: index,
        moving: false,
        visible: false,
      };
    });
  }

  function makeGuide(world, navigation, blocked) {
    const sun = world.labels.find(label => label.name === '创造太阳');
    const route = sun && navigation?.route(world.spawn, sun);
    const nearGate = route?.find(point => {
      const gap = Math.hypot(point.x - world.spawn.x, point.y - world.spawn.y);
      return gap >= 6 && gap <= 10.5;
    });
    const right = { x: world.spawn.x + 7, y: world.spawn.y };
    const guidePosition = nearGate || (blocked(right.x, right.y) ? world.spawn : right);
    return {
      ...guidePosition,
      id: 'south-gate-guide',
      name: '南门的许同学',
      dir: 'down',
      moving: false,
      color: '#477b9a',
      greeting: '你好，欢迎来唐岛湾。我在南门附近等同学，你想问点什么？',
      topics: [
        { label: '哪里适合先去？', reply: '进南门就能走上光华大道，沿路往前走，先看看「创造太阳」雕塑吧。' },
        { label: '想认识同学', reply: '课间走在教学楼和光华大道附近，很容易遇到来回走动的同学。走近了就能打招呼。' },
        { label: '想慢慢逛', reply: '那就按自己的节奏走吧。想辨认地标时，可以打开校园地图。' },
      ],
    };
  }

  function makeCars(world) {
    const vehicles = [];
    for (const road of world.roads) {
      if (!motorRoads.has(road.name) || road.tunnel || road.layer < 0) continue;
      const track = makeTrack(road.points.map(([x, y]) => ({ x, y })));
      if (track.length < 45) continue;
      const amount = Math.max(1, Math.round(track.length / 112));
      const speed = 15 + (road.osmWay || vehicles.length) % 3;
      for (let index = 0; index < amount; index++) {
        const car = {
          road: road.name,
          track,
          distance: track.length * (index + 0.48) / amount,
          speed,
          color: carColors[vehicles.length % carColors.length],
        };
        vehicles.push(positionOn(track, car.distance, 1, car));
      }
    }
    return vehicles;
  }

  function makeLocations(world, navigator) {
    const markers = new Map(world.labels.map(marker => [marker.name, marker]));
    const locations = new Map([['南门', { name: '南门', ...world.spawn }]]);
    const tracks = new Map();

    function get(name) {
      if (locations.has(name)) return locations.get(name);
      const point = navigator?.landing(markers.get(name));
      const location = point ? { name, ...point } : null;
      locations.set(name, location);
      return location;
    }

    function route(from, to) {
      if (!from || !to || from === to) return null;
      const key = from.name + '→' + to.name;
      if (!tracks.has(key)) {
        const path = navigator?.route(from, to);
        const track = path?.length ? makeTrack(path) : null;
        tracks.set(key, track?.length ? track : null);
        if (track?.length) tracks.set(to.name + '→' + from.name, makeTrack([...path].reverse()));
      }
      return tracks.get(key);
    }

    return { get, route };
  }

  function normalizeSchedule(schedule, locations) {
    const source = schedule ?? lessons.flatMap(([start, end]) =>
      places.classes.map(landmark => ({ start, end, landmark })));
    const entries = source.filter(entry => Number.isFinite(entry.start) && Number.isFinite(entry.end) &&
      entry.start >= 0 && entry.end > entry.start && entry.end <= DAY_MINUTES && locations.get(entry.landmark));
    const periods = new Map();
    for (const { start, end, landmark } of entries.sort((a, b) => a.start - b.start || a.end - b.end)) {
      if (!periods.has(start)) periods.set(start, { start, end, rooms: [] });
      const period = periods.get(start);
      if (!period.rooms.some(room => room.landmark === landmark)) period.rooms.push({ end, landmark });
      period.end = Math.max(period.end, end);
    }
    return [...periods.values()];
  }

  function makeItineraries(people, locations, periods, weather) {
    const shelter = weather === 'rain' || weather === 'snow' || weather === 'wind';
    const indoor = new Map();
    const homes = places.homes.map(locations.get).filter(Boolean);
    const plans = people.map(person => {
      const place = homes[person.preference % homes.length] || locations.get('南门');
      const plan = { person, home: place, place, available: 0, steps: [] };
      stay(plan, 0, '在宿舍休息');
      return plan;
    });

    function append(plan, step) {
      const steps = plan.steps;
      if (steps.at(-1)?.start === step.start) steps.pop();
      steps.push(step);
    }

    function stay(plan, start, status, options = {}) {
      append(plan, {
        start, status, location: plan.place.name, destination: plan.place.name, point: plan.place,
        moving: false, visible: false, queue: false, ...options,
      });
    }

    function traverse(plan, start, end, track, status, destination, fromDistance = 0, endDistance = track.length) {
      const step = {
        start, end, track, status, destination, location: '校园道路', fromDistance, endDistance,
        visible: true, moving: true, queue: false,
      };
      append(plan, step);
      return step;
    }

    function closest(plan, names, variation = 0) {
      const options = names.map(locations.get).filter(Boolean)
        .map(place => ({ place, distance: locations.route(plan.place, place)?.length ?? (plan.place === place ? 0 : Infinity) }))
        .filter(option => Number.isFinite(option.distance)).sort((a, b) => a.distance - b.distance);
      return options[Math.min(variation, options.length - 1)]?.place;
    }

    function trip(plan, place, requested, status) {
      const track = locations.route(plan.place, place);
      if (!track) return null;
      const start = Math.max(plan.available, requested);
      const end = start + track.length / plan.person.speed;
      const move = traverse(plan, start, end, track, status, place.name);
      plan.place = place;
      plan.available = end;
      stay(plan, end, '到达' + place.name, { visible: true });
      return move;
    }

    function duration(plan, place) {
      return (locations.route(plan.place, place)?.length || 0) / plan.person.speed;
    }

    function queue(plan, move, position, turn, status) {
      const arrival = plan.available;
      if (!move || turn - arrival <= 0.15) return;
      const track = move.track;
      const distance = track.length - Math.min(track.length * 0.45, 20, 1.4 + position * 0.95);
      const point = positionOn(track, distance, 1);
      move.endDistance = distance;
      stay(plan, arrival, status, { point, visible: true, queue: true });
      traverse(plan, Math.max(arrival, turn - 0.23), turn, track, status, plan.place.name, distance);
      plan.available = turn;
    }

    function library(plan, start, until) {
      const place = closest(plan, places.reading, plan.person.preference % 3 === 0 ? 1 : 0);
      if (!place) return 'unavailable';
      const arrival = Math.max(start, plan.available) + duration(plan, place);
      if (arrival + 3 >= until) return 'unavailable';
      const reservations = indoor.get(place.name) || [];
      const times = [arrival, ...reservations.map(([begin]) => begin).filter(begin => begin > arrival && begin < until)];
      if (times.some(time => reservations.filter(([begin, end]) =>
        begin <= time && end > time).length >= libraryCapacity)) return 'full';
      if (plan.place !== place && !trip(plan, place, start, '去图书馆读书')) return 'unavailable';
      reservations.push([arrival, until]);
      indoor.set(place.name, reservations);
      stay(plan, arrival, '在图书馆读书');
      stay(plan, until, shelter ? '在图书馆门厅休息' : '在图书馆门口等候', { visible: !shelter });
      plan.available = until;
      return true;
    }

    function resting(plan, start, until, status = '在广场休息') {
      const place = closest(plan, shelter ? places.sports : places.lounge, plan.person.preference % 2);
      if (Math.max(start, plan.available) + duration(plan, place) + 1 >= until) return false;
      if (!place || !(plan.place === place || trip(plan, place, start, shelter ? '去室内休息' : '去休息区'))) return false;
      stay(plan, Math.max(start, plan.available), shelter ? '在室内休息' : status, { visible: !shelter });
      plan.available = Math.max(plan.available, until);
      return true;
    }

    function libraryOrRest(plan, start, until) {
      const outcome = library(plan, start, until);
      return outcome === true || resting(plan, start, until, outcome === 'full' ? '在广场歇脚，等图书馆有座' : '在广场休息');
    }

    function outsideClass(plan, release, until) {
      const target = closest(plan, places.lounge, plan.person.preference % 2);
      const track = locations.route(plan.place, target);
      if (!track || until - release < 1.05) {
        stay(plan, release, '在教学楼门口等候', { visible: true });
        return;
      }
      const distance = Math.min(track.length, 5 + plan.person.preference % 7,
        (until - release) * plan.person.speed * 0.37);
      const walkTime = distance / plan.person.speed;
      traverse(plan, release, release + walkTime, track, '出来透气', plan.place.name, 0, distance);
      stay(plan, release + walkTime, '在教学楼外休息', { point: positionOn(track, distance, 1), visible: true });
      traverse(plan, until - walkTime, until, track, '返回教学楼门口', plan.place.name, distance, 0);
      stay(plan, until, '在教学楼门口等候', { visible: true });
      plan.available = until;
    }

    function disperse(plan, start, until) {
      const { preference } = plan.person;
      if (preference % 4 === 1 && libraryOrRest(plan, start, until)) return;
      if (preference % 4 === 2 || preference % 4 === 3) {
        const sports = closest(plan, places.sports);
        if (trip(plan, sports, start, '下课去运动') || plan.place === sports) {
          stay(plan, Math.max(start, plan.available), '在体育馆运动');
          plan.available = Math.max(plan.available, until);
          return;
        }
      }
      trip(plan, plan.home, start, '下课回宿舍');
      stay(plan, Math.max(start, plan.available), '在宿舍休息');
    }

    const attendance = plans.slice(0, -6);
    function classes(period, index) {
      const next = periods[index + 1];
      const rooms = new Map(period.rooms.map(room => [room.landmark, { ...room, visitors: [] }]));
      for (const plan of attendance) {
        const student = plan.person.preference;
        if ((student * 7 + index * 3) % 11 === 0) continue;
        const room = period.rooms[(student + Math.floor(index / 2)) % period.rooms.length];
        const place = locations.get(room.landmark);
        const ready = period.start - 3.8 + (student * 7 % 19) * 0.26;
        const movement = trip(plan, place, ready - duration(plan, place), '赶去上课');
        if (plan.place !== place) continue;
        rooms.get(room.landmark).visitors.push({
          plan, movement, arrival: Math.max(plan.available, ready), student,
        });
      }

      for (const room of rooms.values()) {
        const visitors = room.visitors.sort((a, b) => a.arrival - b.arrival);
        const capacity = period.rooms.length === 1 ? classroomCapacity : 7;
        const separation = period.rooms.length === 1 ? 0.3 : 0.63;
        const entries = [];
        let atDoor = period.start - 3.3;
        for (const [position, visitor] of visitors.entries()) {
          const { plan, movement, arrival, student } = visitor;
          const entry = Math.max(arrival, atDoor + separation);
          const ahead = entries.filter(time => time > arrival).length;
          entries.push(entry);
          atDoor = entry;
          queue(plan, movement, ahead, entry, '排队进教室');
          if (entry >= room.end) {
            stay(plan, entry, '错过本节课，在教学楼门口等候', { visible: true });
            plan.available = entry;
            continue;
          }
          const standing = position >= capacity;
          stay(plan, entry, standing ? '教室已满，在后排站着听课' : '在教室听课');
          const release = room.end + Math.min(3.8, position * 0.17) + student % 3 * 0.09;
          plan.available = release;
          const shortBreak = next && next.start - room.end <= 7 && next.start >= room.end;
          if (shortBreak) {
            if (!shelter && student % 3 === 0) {
              outsideClass(plan, release, Math.max(release + 0.6, next.start - 1.4));
            } else if (!shelter && student % 3 === 1) {
              stay(plan, release, '下课后在门口等同学', { visible: true });
            } else {
              stay(plan, release, '在教学楼内等待下一节课');
            }
          } else if (room.end < mealTime && !next) {
            disperse(plan, release, mealTime - 4);
          } else if (room.end >= mealTime - 2 && room.end < mealTime + 30) {
            stay(plan, release, '下课后准备去吃饭', { visible: true });
          } else if (!next || next.start - room.end >= 45 || next.start < room.end) {
            disperse(plan, release, Math.max(release + 18, Math.min(room.end + 50, next?.start - 16 || DAY_MINUTES - 2)));
          } else if (student % 3 === 0 && libraryOrRest(plan, release, next.start - 7)) {
            continue;
          } else if (student % 3 === 1 && next.start - release > 13 &&
              resting(plan, release, next.start - 7)) {
            continue;
          } else if (!shelter) {
            outsideClass(plan, release, Math.min(release + 7, next.start - 3));
          } else {
            stay(plan, release, '在教学楼内等候');
          }
        }
      }
    }

    function lunches() {
      const diners = attendance.map(plan => {
        const start = mealTime + 2 + Math.floor(plan.person.preference / 9) * 4.4 + plan.person.preference % 3 * 0.35;
        const place = closest(plan, places.meals, plan.person.preference % 4 === 0 ? 1 : 0);
        const move = trip(plan, place, start, '去餐厅吃午饭');
        return { plan, move, arrival: Math.max(plan.available, start) };
      }).filter(({ move }) => move).sort((a, b) => a.arrival - b.arrival);
      const counters = new Map();
      for (const { plan, move, arrival } of diners) {
        const line = counters.get(plan.place.name) || { next: mealTime, entries: [] };
        const service = Math.max(arrival, line.next);
        queue(plan, move, line.entries.filter(time => time > arrival).length, service, '在餐厅门口排队');
        line.next = service + 1.3;
        line.entries.push(service);
        counters.set(plan.place.name, line);
        stay(plan, service, '在餐厅吃午饭');
        const finish = service + 15 + plan.person.preference % 7;
        plan.available = finish;
        if (plan.person.preference % 3 === 1 && libraryOrRest(plan, finish, afternoon - 16)) continue;
        trip(plan, plan.home, finish, '吃完午饭回宿舍');
        stay(plan, Math.max(plan.available, finish), '在宿舍午休');
      }
    }

    let lunchPlanned = false;
    for (const [index, period] of periods.entries()) {
      if (!lunchPlanned && period.start >= mealTime) {
        lunches();
        lunchPlanned = true;
      }
      classes(period, index);
    }
    if (!lunchPlanned) lunches();

    for (const [index, plan] of plans.slice(-6).entries()) {
      const start = 474 + index * 10;
      resting(plan, start, 547 + index * 3);
      libraryOrRest(plan, 550 + index * 2, 694 + index * 2);
      trip(plan, closest(plan, places.meals), 748 + index * 3, '去餐厅吃午饭');
      stay(plan, plan.available, '在餐厅吃午饭');
      libraryOrRest(plan, 833 + index * 4, 939 + index * 2);
      resting(plan, 959 + index * 7, 1038 + index * 4);
      disperse(plan, 1045 + index * 5, 1140 + index * 4);
    }
    return plans;
  }

  function stepAt(plan, minutes) {
    const steps = plan.steps;
    let first = 0;
    let last = steps.length - 1;
    while (first < last) {
      const middle = Math.ceil((first + last) / 2);
      if (steps[middle].start <= minutes) first = middle;
      else last = middle - 1;
    }
    return steps[first];
  }

  function updatePerson(plan, minutes) {
    const person = plan.person;
    const step = stepAt(plan, minutes);
    if (step.track) {
      const elapsed = Math.min(1, Math.max(0, (minutes - step.start) / (step.end - step.start)));
      const distance = step.fromDistance + (step.endDistance - step.fromDistance) * elapsed;
      positionOn(step.track, distance, Math.sign(step.endDistance - step.fromDistance), person);
    } else {
      person.x = step.point.x;
      person.y = step.point.y;
      person.dir ||= 'down';
    }
    person.status = step.status;
    person.destination = step.destination;
    person.location = step.location;
    person.queue = step.queue;
    person.visible = step.visible;
    person.moving = step.moving;
  }

  function crowdAudio() {
    let context;
    let gain;
    let enabled = false;
    let lastUpdate = -Infinity;

    function setEnabled(value) {
      enabled = Boolean(value);
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return false;
      if (enabled && !context) {
        try {
          context = new Audio();
          const noise = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
          const samples = noise.getChannelData(0);
          for (let index = 0; index < samples.length; index++) {
            const time = index / context.sampleRate;
            const murmur = 0.6 + 0.18 * Math.sin(time * Math.PI * 7.5) + 0.14 * Math.sin(time * Math.PI * 13);
            samples[index] = (Math.random() * 2 - 1) * murmur;
          }
          const source = context.createBufferSource();
          source.buffer = noise;
          source.loop = true;
          const filter = context.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.value = 700;
          filter.Q.value = 0.55;
          gain = context.createGain();
          gain.gain.value = 0;
          source.connect(filter).connect(gain).connect(context.destination);
          source.start();
        } catch {
          enabled = false;
          return false;
        }
      }
      if (enabled) context.resume().catch(() => setEnabled(false));
      else if (gain) gain.gain.setTargetAtTime(0, context.currentTime, 0.15);
      return enabled;
    }

    function update(density) {
      if (!enabled || !gain || context.currentTime - lastUpdate < 0.18) return;
      lastUpdate = context.currentTime;
      gain.gain.setTargetAtTime(Math.min(0.11, density * 0.11), lastUpdate, 0.22);
    }

    return { setEnabled, update };
  }

  function create(world, blocked = () => false, navigator = window.PixelNavigation?.build(world, blocked)) {
    const scheduledPeople = makePeople();
    const vehicles = makeCars(world);
    const guide = makeGuide(world, navigator, blocked);
    Object.assign(guide, { visible: true, status: '在校门口等同学', location: '南门', destination: '南门' });
    const people = [guide, ...scheduledPeople];
    const students = [guide];
    const locations = makeLocations(world, navigator);
    const audio = crowdAudio();
    const crowd = { visible: 1, moving: 0, queued: 0, indoors: scheduledPeople.length, density: 0 };
    let absolute = START_MINUTE;
    let speed = 1;
    let weather = 'clear';
    let listener = null;
    let signature;
    let periods = normalizeSchedule(null, locations);
    let plans = makeItineraries(scheduledPeople, locations, periods, weather);

    function minuteOfDay() {
      return wrap(absolute, DAY_MINUTES);
    }

    function currentBreak(minutes = minuteOfDay()) {
      const period = periods.findLast(entry => entry.end <= minutes);
      const next = period && periods.find(entry => entry.start >= period.end);
      const length = next && next.start - period.end;
      return length > 0 && length <= 30 && minutes < next.start ? length : 0;
    }

    function refreshPopulation() {
      const minutes = minuteOfDay();
      students.length = 1;
      let moving = 0;
      let queued = 0;
      let local = 0;
      for (const plan of plans) {
        updatePerson(plan, minutes);
        const person = plan.person;
        if (!person.visible) continue;
        students.push(person);
        if (person.moving) moving++;
        if (person.queue) queued++;
        if (listener) {
          const distance = Math.hypot(listener.x - person.x, listener.y - person.y);
          local += Math.max(0, 1 - distance / 52) * (person.moving ? 1 : 0.8);
        }
      }
      crowd.visible = students.length;
      crowd.moving = moving;
      crowd.queued = queued;
      crowd.indoors = people.length - students.length;
      crowd.density = Math.min(1, listener ? local / 7 : (moving + queued) / 27);
      audio.update(crowd.density);
    }

    function phase() {
      const minutes = minuteOfDay();
      const pause = currentBreak(minutes);
      if (pause) return pause > 7 ? '大课间' : '课间';
      const current = periods.find(entry => minutes >= entry.start && minutes < entry.end);
      if (current) return '上课';
      if (minutes >= mealTime && minutes < mealTime + 48) return '午餐';
      if (minutes >= mealTime + 48 && minutes < afternoon - 20) return '午休';
      if (periods.some(entry => entry.start > minutes && entry.start - minutes <= 20)) return '课前';
      if (periods.some(entry => minutes >= entry.end && minutes - entry.end < 22)) return '下课';
      return '自由时段';
    }

    refreshPopulation();

    return {
      vehicles,
      people,
      students,
      crowd,
      get minutes() { return minuteOfDay(); },
      get absoluteMinutes() { return absolute; },
      get day() { return Math.floor(absolute / DAY_MINUTES) + 1; },
      get speed() { return speed; },
      get weather() { return weather; },
      get breakActive() { return Boolean(currentBreak()); },
      get phase() { return phase(); },
      get crowdActivity() {
        if (crowd.queued >= 3) return '门口排队';
        if (crowd.moving >= 15) return '人流较多';
        if (crowd.moving >= 5) return '有人走动';
        return '道路安静';
      },
      setSchedule(schedule) {
        if (schedule != null && !Array.isArray(schedule)) return;
        const next = schedule == null ? undefined : JSON.stringify(schedule.map(({ start, end, landmark }) =>
          [start, end, landmark]));
        if (next === signature) return;
        signature = next;
        periods = normalizeSchedule(schedule, locations);
        plans = makeItineraries(scheduledPeople, locations, periods, weather);
        refreshPopulation();
      },
      setSpeed(multiplier) {
        if (Number.isFinite(multiplier) && multiplier >= 0) speed = multiplier;
      },
      setWeather(value) {
        if (!weathers.has(value) || value === weather) return;
        weather = value;
        plans = makeItineraries(scheduledPeople, locations, periods, weather);
        refreshPopulation();
      },
      setListener(point) { listener = point; },
      setAudioEnabled(value) { return audio.setEnabled(value); },
      countAt(name, radius = 12) {
        const point = locations.get(name);
        if (!point) return 0;
        return people.reduce((count, person) => count + Number(
          person.visible ? Math.hypot(person.x - point.x, person.y - point.y) <= radius : person.location === name
        ), 0);
      },
      seek(value) {
        if (!Number.isFinite(value)) return;
        absolute = value >= DAY_MINUTES ? value : Math.floor(absolute / DAY_MINUTES) * DAY_MINUTES + wrap(value, DAY_MINUTES);
        refreshPopulation();
      },
      update(seconds, absoluteMinute) {
        const hasTime = Number.isFinite(absoluteMinute) && absoluteMinute >= 0;
        if (hasTime) absolute = absoluteMinute;
        if (!Number.isFinite(seconds) || seconds <= 0) {
          if (hasTime) refreshPopulation();
          return;
        }
        if (!hasTime) absolute += seconds * speed * MINUTES_PER_SECOND;
        if (hasTime || speed > 0 || listener) refreshPopulation();
        for (const car of vehicles) {
          car.distance = wrap(car.distance + seconds * car.speed, car.track.length);
          positionOn(car.track, car.distance, 1, car);
        }
      },
    };
  }

  window.PixelLife = { create };
})();

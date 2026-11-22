(() => {
  'use strict';

  const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const panels = [
    ['schedule', '课表'], ['courses', '课程'], ['life', '生活'], ['social', '同学'],
    ['report', '成绩'], ['profile', '角色'], ['crowd', '人流'],
  ];
  const dorm = '19号学生公寓';
  const libraries = ['图书馆总馆', '图书馆东馆'];
  const dining = ['唐岛湾餐厅', '荟萃苑餐厅', '玉兰苑餐厅', '学苑餐厅'];
  const statuses = { upcoming: '未开始', available: '可进入', active: '进行中', completed: '已完成', missed: '缺席' };
  const attendanceLabels = { 'on-time': '准时到课', late: '迟到', absent: '缺席' };
  const homeworkLabels = { upcoming: '尚未开放', available: '待完成', overdue: '可补交', completed: '已完成', late: '补交完成', missed: '未交' };
  const difficultyNames = { easy: '简单', medium: '中等', hard: '较难' };
  const metrics = [
    ['hunger', '饥饿', ''], ['energy', '精力', ''], ['health', '健康', ''],
    ['allowance', '生活费', '¥'], ['mood', '心情', ''], ['stress', '压力', ''],
  ];

  function clock(minute) {
    const time = Math.floor(minute) % 1440;
    return [Math.floor(time / 60), time % 60].map(value => String(value).padStart(2, '0')).join(':');
  }

  function element(tag, content, className) {
    const node = document.createElement(tag);
    if (content !== undefined) node.textContent = content;
    if (className) node.className = className;
    return node;
  }

  function button(label, onClick, options = {}) {
    const node = element('button', label, options.primary ? 'student-primary' : '');
    node.type = 'button';
    node.disabled = Boolean(options.disabled);
    node.addEventListener('click', onClick);
    return node;
  }

  function group(...children) {
    const row = element('div', undefined, 'student-actions');
    row.append(...children);
    return row;
  }

  function card(title, detail) {
    const article = element('section', undefined, 'student-card');
    article.append(element('h3', title));
    if (detail) article.append(element('p', detail, 'student-meta'));
    return article;
  }

  function titleOfExamination(session) {
    return session.kind === 'exam' ? session.title + ' · 期末考试' : session.title;
  }

  function classroom(profile, position, standing = []) {
    const canvas = element('canvas', undefined, 'student-classroom');
    canvas.width = 384;
    canvas.height = 160;
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', '教室。点击过道移动，或聚焦后按方向键。');
    const context = canvas.getContext('2d');
    const desks = [41, 113, 228, 300].flatMap(x => [61, 92, 123].map(y => ({ x, y })));
    const paint = () => {
      context.fillStyle = '#d8c8a9';
      context.fillRect(0, 0, 384, 160);
      context.fillStyle = '#baa786';
      for (let y = 33; y < 160; y += 10) context.fillRect(0, y, 384, 1);
      context.fillStyle = '#40594d';
      context.fillRect(0, 0, 384, 34);
      context.fillStyle = '#203e35';
      context.fillRect(98, 5, 188, 20);
      context.fillStyle = '#c8dbb5';
      context.font = '11px sans-serif';
      context.textAlign = 'center';
      context.fillText('上 课', 192, 19);
      context.fillStyle = '#789c9a';
      context.fillRect(12, 5, 59, 20);
      context.fillRect(313, 5, 59, 20);
      context.fillStyle = '#957554';
      context.fillRect(170, 41, 44, 10);
      desks.forEach(({ x, y }, index) => {
        context.fillStyle = '#a68b69';
        context.fillRect(x + 5, y + 2, 41, 12);
        context.fillStyle = '#ecd3a2';
        context.fillRect(x, y, 43, 11);
        context.fillStyle = '#80694e';
        context.fillRect(x + 16, y + 15, 11, 6);
        if (index % 4 !== 1) {
          context.fillStyle = ['#567b83', '#805f69', '#4b7258'][index % 3];
          context.fillRect(x + 17, y + 12, 10, 8);
          context.fillStyle = '#efce9d';
          context.fillRect(x + 18, y + 9, 8, 6);
        }
      });
      standing.slice(0, 5).forEach((person, index) => {
        const x = 257 + index * 22;
        context.fillStyle = '#f0cd9a';
        context.fillRect(x, 140, 7, 6);
        context.fillStyle = person.color;
        context.fillRect(x - 1, 146, 9, 8);
      });
      context.fillStyle = '#334536';
      context.fillRect(169, 154, 46, 6);
      context.fillStyle = profile.shirt;
      context.fillRect(position.x - 5, position.y - 6, 10, 8);
      context.fillStyle = profile.skin;
      context.fillRect(position.x - 4, position.y - 12, 8, 6);
      context.fillStyle = profile.hair;
      context.fillRect(position.x - 5, position.y - 13, 10, 3);
    };
    const move = (x, y) => {
      if (x < 12 || x > 372 || y < 45 || y > 150) return;
      if (desks.some(desk => x >= desk.x - 5 && x <= desk.x + 48 && y >= desk.y && y <= desk.y + 21)) return;
      Object.assign(position, { x, y });
      paint();
    };
    canvas.addEventListener('click', event => {
      const bounds = canvas.getBoundingClientRect();
      move((event.clientX - bounds.left) * canvas.width / bounds.width, (event.clientY - bounds.top) * canvas.height / bounds.height);
    });
    canvas.addEventListener('keydown', event => {
      const moves = { ArrowLeft: [-6, 0], ArrowRight: [6, 0], ArrowUp: [0, -6], ArrowDown: [0, 6],
        a: [-6, 0], d: [6, 0], w: [0, -6], s: [0, 6] };
      const direction = moves[event.key];
      if (!direction) return;
      event.preventDefault();
      move(position.x + direction[0], position.y + direction[1]);
    });
    paint();
    return canvas;
  }

  function create({ life, ready, beforeOpen, route, goHome, isNear, here, onChange, markStatus, getPosition, restorePosition }) {
    const byId = id => document.getElementById(id);
    const dialog = byId('student-dialog');
    const heading = byId('student-title');
    const content = byId('student-content');
    const feedback = byId('student-feedback');
    const tabs = byId('student-tabs');
    const clockControls = byId('student-clock-controls');
    const store = window.PixelStudentGame;
    const courses = store.courses;
    const calendar = store.calendar;
    const weekOf = day => Math.floor(day / calendar.daysPerWeek) + 1;
    const formatWeek = week => week === calendar.examWeek ? '期末周' : '第 ' + week + ' 周';
    const weekdayOf = day => day % calendar.daysPerWeek;
    const formatDay = day => formatWeek(weekOf(day)) + ' · ' + weekdays[weekdayOf(day)];
    const lastCalendarDay = calendar.examWeek * calendar.daysPerWeek - 1;
    const namedLocations = new Set([...courses.map(course => course.landmark), dorm, ...libraries, ...dining]);
    let student = store.hasSave() ? store.create() : null;
    let social = null;
    let tab = 'schedule';
    let selectedDay = 0;
    let selectedHomeworkWeek = 1;
    let place = null;
    let isBike = false;
    let lastScheduleKey = '';
    let lastHud = '';
    let lastClockMinute = -1;
    let roomPosition = { x: 192, y: 145 };
    let rollCall = '';
    let observedNpc = null;
    let fanSound = false;
    let classReminder = '';

    function showNotice(message) {
      feedback.textContent = message || '';
      if (!dialog.open && message) markStatus(message);
    }

    function syncWorld() {
      life.seek(student.state.absoluteMinute);
      updateSchedule();
      onChange(student.state.profile, isBike);
      updateVitals();
    }

    function buildSocial() {
      social = window.PixelStudentSocial.create({
        state: student.state,
        save: () => student.save(),
        now: () => student.state.absoluteMinute,
        getEnergy: () => student.state.life.energy,
        changeEnergy: amount => student.spendTime(0, amount),
        advance: (minutes, energy = 0) => {
          const result = student.spendTime(minutes, energy);
          if (result.ok) syncWorld();
          return result;
        },
        completePlan(kind, activity) {
          const result = kind === 'meal' ? student.eat('meal') : studyWithClassmate();
          if (!result.ok) return result;
          const extra = kind === 'meal' ? activity.minutes - store.foods.meal.minutes : activity.minutes - 30;
          student.spendTime(extra, kind === 'meal' ? activity.energy - store.foods.meal.energy : activity.energy + 9);
          syncWorld();
          return result;
        },
      });
    }

    function studyWithClassmate() {
      const [id] = [...student.state.enrollment].sort((a, b) => student.state.mastery[a] - student.state.mastery[b]);
      const result = student.study(id);
      return result.ok ? { ...result, message: courses.find(course => course.id === id).title + ' · ' + result.message } : result;
    }

    function activate() {
      student = store.create({ startMinute: 485 });
      student.save();
      buildSocial();
      syncWorld();
      show('profile');
    }

    function updateSchedule() {
      const key = student.dayIndex + ':' + student.state.enrollment.join(',');
      if (lastScheduleKey === key) return;
      lastScheduleKey = key;
      const offset = student.dayIndex * calendar.dayMinutes;
      life.setSchedule?.(student.schedule().map(session => ({
        start: session.start - offset, end: session.end - offset, landmark: session.landmark,
      })));
    }

    function playBell() {
      if (typeof life.ringBell === 'function') {
        life.ringBell();
        return;
      }
      if (typeof window.AudioContext !== 'function') return;
      const audio = playBell.audio;
      if (!audio || audio.state !== 'running') return;
      const oscillator = audio.createOscillator();
      const volume = audio.createGain();
      oscillator.frequency.setValueAtTime(660, audio.currentTime);
      volume.gain.setValueAtTime(0.055, audio.currentTime);
      volume.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.35);
      oscillator.connect(volume).connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.36);
    }

    function tick() {
      if (!student) return;
      const absoluteMinutes = life.absoluteMinutes ?? life.minutes + student.dayIndex * calendar.dayMinutes;
      const minute = Math.floor(absoluteMinutes);
      if (minute === lastClockMinute) return;
      lastClockMinute = minute;
      const before = student.state.absoluteMinute;
      student.sync(absoluteMinutes);
      updateSchedule();
      const day = Math.floor(minute / calendar.dayMinutes);
      if (student.schedule(day).some(session =>
        (session.start > before && session.start <= minute) || (session.end > before && session.end <= minute))) {
        playBell();
      }
      const next = upcoming();
      const message = next && !student.state.activeClass && !student.state.activeExam && next.left > 0 && next.left <= 15
        ? clock(next.next.start) + ' ' + titleOfExamination(next.next) : '';
      if (message !== classReminder) {
        classReminder = message;
        byId('student-next-class').textContent = message;
      }
      updateVitals();
    }

    function updateVitals() {
      byId('student-vitals').hidden = !student;
      clockControls.hidden = !student;
      byId('clock-jump').hidden = Boolean(student);
      if (!student) return;
      const shownWeek = student.state.semesterReport ? '学期结束' : student.week > calendar.examWeek ? '补考时段' : formatWeek(student.week);
      byId('student-day').textContent = shownWeek;
      const values = metrics.map(([key]) => Math.round(student.state.life[key]));
      const key = values.join(',');
      if (lastHud === key) return;
      lastHud = key;
      byId('student-metrics').replaceChildren(...metrics.map(([, label, unit], index) => {
        const row = element('div');
        row.append(element('dt', label), element('dd', unit + (Number.isFinite(values[index]) ? values[index] : '—')));
        if ((index === 0 || index === 5) ? values[index] >= 75 : (index === 1 || index === 2) && values[index] <= 25) {
          row.classList.add('student-warning');
        }
        return row;
      }));
    }

    function stamp(result) {
      if (result.ok) {
        syncWorld();
        render();
      }
      showNotice(result.message);
      return result.ok;
    }

    function goTo(name) {
      if (isNear(name)) {
        if (namedLocations.has(name)) show('location', name);
        else showNotice('已经在' + name + '附近。');
        return;
      }
      if (route(name)) dialog.close();
      else showNotice('从这里暂时找不到通往' + name + '的可走路线。');
    }

    function show(nextTab = 'schedule', location = null) {
      if (student) {
        tick();
        if (nextTab === 'schedule' && tab !== 'schedule') selectedDay = Math.min(student.dayIndex, lastCalendarDay);
        if (nextTab === 'courses' && tab !== 'courses') selectedHomeworkWeek = Math.min(student.week, calendar.teachingWeeks);
      }
      if (!dialog.open) {
        beforeOpen();
        dialog.showModal();
      }
      tab = nextTab;
      place = location;
      showNotice('');
      render();
    }

    function advanceTo(minute) {
      if (minute <= student.state.absoluteMinute) return true;
      const result = student.fastForward(minute);
      if (result.ok) syncWorld();
      showNotice(result.message);
      return result.ok;
    }

    function upcoming() {
      const next = student.nextSession();
      if (!next) return null;
      const left = Math.ceil(next.start - student.state.absoluteMinute);
      return { next, left };
    }

    function scheduleView() {
      const absoluteDay = student.dayIndex;
      const upcomingSession = upcoming();
      const phase = student.state.semesterReport ? '学期结束' : student.week > calendar.examWeek ? '补考时段' : formatDay(absoluteDay);
      let nextDetail = '可查看学期成绩或继续在校园活动。';
      if (upcomingSession) {
        const { next, left } = upcomingSession;
        let when = '现在可进入';
        if (next.status === 'active') when = '进行中';
        else if (next.dayIndex > absoluteDay) when = formatDay(next.dayIndex) + ' ' + clock(next.start);
        else if (next.kind === 'exam' && next.dayIndex < absoluteDay) when = '可补考';
        else if (left > 0) when = left + ' 分钟后开始';
        nextDetail = titleOfExamination(next) + ' · ' + next.landmark + ' · ' + when;
      }
      const today = card(phase, nextDetail);
      const progress = element('progress');
      progress.max = calendar.teachingWeeks * calendar.daysPerWeek;
      progress.value = Math.min(absoluteDay, progress.max);
      progress.setAttribute('aria-label', '教学周进度');
      const teachingWeek = Math.min(student.week, calendar.teachingWeeks);
      today.append(progress, element('p',
        student.week <= calendar.teachingWeeks
          ? '教学周 ' + teachingWeek + '/' + calendar.teachingWeeks + ' · 第 ' + calendar.examWeek + ' 周参加期末考试'
          : '已完成 ' + calendar.teachingWeeks + ' 个教学周', 'student-meta'));
      const future = student.nextUpcomingSession();
      if (future && !student.state.activeClass && !student.state.activeExam) {
        const remaining = future.start - student.state.absoluteMinute;
        today.append(group(button('跳到开课前 15 分钟', () => {
          if (!advanceTo(future.start - 15)) return;
          selectedDay = future.dayIndex;
          render();
        }, { disabled: remaining <= 15 }), button('跳到开课', () => {
          if (!advanceTo(future.start)) return;
          selectedDay = future.dayIndex;
          render();
        })));
        if (upcomingSession && upcomingSession.left <= 0) {
          today.append(element('p', '快进会跳过当前时段。', 'student-meta'));
        }
        if (future.dayIndex > absoluteDay) {
          today.append(element('p', '跨日快进会按经过的时间结算饥饿和精力。', 'student-meta'));
        }
      }
      if (upcomingSession?.next.kind === 'exam' && upcomingSession.next.dayIndex < absoluteDay) {
        const venue = upcomingSession.next.landmark;
        today.append(group(button(isNear(venue) ? '查看考场' : '前往补考考场', () => goTo(venue))));
      }
      content.append(today);
      const selectedWeek = weekOf(selectedDay);
      const picker = element('select');
      picker.setAttribute('aria-label', '课表周次');
      for (let week = 1; week <= calendar.examWeek; week++) picker.add(new Option(formatWeek(week), String(week)));
      picker.value = String(selectedWeek);
      picker.addEventListener('change', () => {
        selectedDay = (Number(picker.value) - 1) * calendar.daysPerWeek;
        render();
        content.querySelector('select[aria-label="课表周次"]').focus();
      });
      const sessions = student.schedule(selectedDay);
      const nowDay = Math.min(absoluteDay, lastCalendarDay);
      content.append(group(picker, button('回到本日课表', () => { selectedDay = nowDay; render(); }, { disabled: selectedDay === nowDay })));
      const dayButtons = group(...weekdays.map((weekday, index) => {
        const day = (selectedWeek - 1) * calendar.daysPerWeek + index;
        const choice = button(weekday, () => { selectedDay = day; render(); });
        choice.setAttribute('aria-pressed', String(selectedDay === day));
        return choice;
      }));
      content.append(dayButtons);
      if (!sessions.length) {
        const empty = selectedWeek === calendar.examWeek
          ? '当天没有安排期末考试，未完成的科目仍可到原考场补考。'
          : '当天没有排课，可以自习、补作业或在校园活动。';
        content.append(card(formatDay(selectedDay), empty));
      }
      for (const session of sessions) {
        const lesson = card(titleOfExamination(session),
          clock(session.start) + '–' + clock(session.end) + ' · ' + session.landmark + ' ' + session.room +
          ' · ' + session.teacher + ' · ' + (attendanceLabels[session.attendance] || statuses[session.status] || session.status));
        if (session.lesson?.title) lesson.append(element('p', '本节 · ' + session.lesson.title, 'student-meta'));
        lesson.append(group(button(isNear(session.landmark) ? '查看教室' : '沿路前往', () => goTo(session.landmark))));
        content.append(lesson);
      }
      if (absoluteDay === 0 && student.state.absoluteMinute < 530) {
        const select = card('选课', '至少选一门。第一堂课开始后，课表会锁定。');
        const form = element('form', undefined, 'student-form');
        courses.forEach(course => {
          const label = element('label', undefined, 'student-check');
          const input = element('input');
          input.type = 'checkbox';
          input.value = course.id;
          input.checked = student.state.enrollment.includes(course.id);
          label.append(input, document.createTextNode(course.title));
          form.append(label);
        });
        form.append(group(button('保存选课', () => {
          const selected = [...form.querySelectorAll('input:checked')].map(input => input.value);
          stamp(student.setEnrollment(selected));
        })));
        select.append(form);
        content.append(select);
      }
    }

    function coursesView() {
      const picker = element('select');
      picker.setAttribute('aria-label', '作业周次');
      for (let week = 1; week <= calendar.teachingWeeks; week++) picker.add(new Option(formatWeek(week), String(week)));
      picker.value = String(selectedHomeworkWeek);
      picker.addEventListener('change', () => {
        selectedHomeworkWeek = Number(picker.value);
        render();
        content.querySelector('select[aria-label="作业周次"]').focus();
      });
      const homeworkWeek = card('每周作业', '作业随教学周开放。按时完成得 100 分，开始该科考试前补交可得 70 分。');
      homeworkWeek.append(group(picker));
      content.append(homeworkWeek);
      for (const course of courses.filter(item => student.state.enrollment.includes(item.id))) {
        const mastery = Math.round(student.state.mastery[course.id] || 0);
        const progress = card(course.title, course.landmark + ' ' + course.room + ' · 掌握度 ' + mastery + '/100');
        const meter = element('progress');
        meter.max = 100;
        meter.value = mastery;
        meter.setAttribute('aria-label', course.title + '掌握度');
        const studyNear = libraries.find(isNear);
        const assignment = student.homework(course.id, selectedHomeworkWeek);
        const canDo = ['available', 'overdue'].includes(assignment.status);
        const assignmentStatus = homeworkLabels[assignment.status] + (assignment.score === null ? '' : ' · ' + assignment.score + '/100');
        const assignmentAction = assignment.status === 'overdue' ? '补交作业' : '做作业';
        progress.append(meter, element('p', formatWeek(selectedHomeworkWeek) + '作业 · ' + assignmentStatus, 'student-meta'), group(
          button(canDo ? assignmentAction + ' · 30 分钟 / 精力 −12' : assignmentStatus,
            () => stamp(student.doHomework(course.id, selectedHomeworkWeek)), {
            disabled: !canDo,
          }),
          button(studyNear ? '在图书馆自习' : '前往图书馆', () => {
            if (studyNear) stamp(student.study(course.id));
            else goTo(libraries[0]);
          }),
        ));
        content.append(progress);
      }
      content.append(element('p', '作业会消耗校园时间和精力。开始期末考试时，课程掌握度越高，题目越容易。', 'student-meta'));
    }

    function lifeView() {
      const values = card('生活状态', '饥饿和压力越低越好。及时吃饭和睡觉可以恢复状态。');
      const list = element('dl', undefined, 'student-life-list');
      for (const [key, label, unit] of metrics) {
        const value = Math.round(student.state.life[key]);
        const row = element('div');
        row.append(element('dt', label), element('dd', (unit || '') + value));
        list.append(row);
      }
      values.append(list);
      content.append(values);
      const essentials = card('校园生活');
      const nearDining = dining.find(isNear);
      essentials.append(group(
        button(nearDining ? '吃一顿饭 · ¥' + store.foods.meal.price : '前往餐厅', () => nearDining ? stamp(student.eat('meal')) : goTo(dining[0])),
        button(nearDining ? '买份零食 · ¥' + store.foods.snack.price : '去买零食', () => nearDining ? stamp(student.eat('snack')) : goTo(dining[0])),
        button(nearDining ? '买日用品 · ¥' + store.supplies.price : '前往校园补给点', () => nearDining ? stamp(student.buySupplies()) : goTo(dining[0])),
        button(isNear(dorm) ? '睡到明天' : '回学生公寓', () => isNear(dorm) ? sleep() : goTo(dorm)),
        button(isBike ? '下车步行' : '骑自行车', () => {
          isBike = !isBike;
          onChange(student.state.profile, isBike);
          render();
        }),
      ));
      content.append(essentials);
    }

    function sleep() {
      if (!stamp(student.sleep())) return;
      goHome(dorm);
      selectedDay = Math.min(student.dayIndex, lastCalendarDay);
      show('schedule');
      showNotice('睡醒了。今天的课表已更新。');
    }

    function socialContext() {
      if (!student) return {};
      const day = student.dayIndex + 1;
      const minute = Math.floor(student.state.absoluteMinute) % calendar.dayMinutes;
      const recentClass = [...student.schedule()].reverse().find(session =>
        session.kind === 'class' && session.end <= student.state.absoluteMinute && ['late', 'absent'].includes(session.attendance));
      return { day, minute, place: here(), inClass: Boolean(student.state.activeClass || student.state.activeExam),
        course: recentClass ? { ...courses.find(course => course.id === recentClass.courseId), lesson: recentClass.lesson } : null };
    }

    function socialResult(result) {
      if (result?.notice || result?.text) showNotice(result.notice || result.text);
      updateVitals();
      render();
    }

    function socialView() {
      const contacts = social.contacts();
      const listing = card('联系人', contacts.length ? '' : '在校园里接近同学，按 E 打招呼。');
      const roster = element('ul', undefined, 'student-list');
      for (const contact of contacts) {
        const item = element('li', undefined, 'student-contact');
        item.append(button(contact.name + ' · ' + contact.relationship + (contact.isRoommate ? ' · 室友' : ''), () => {
          render();
          showSocialMessage(contact.id, social.dialogue(contact.id, socialContext()));
        }));
        if (contact.description) item.append(element('p', contact.description, 'student-meta'));
        roster.append(item);
      }
      listing.append(roster);
      const roommate = social.roommate();
      if (roommate) listing.append(group(button('查看室友消息', () => {
        const message = social.inviteRoommate(socialContext());
        showSocialMessage(roommate.id || roommate.peerId, message);
      })));
      content.append(listing);
      const plans = social.plans(socialContext());
      if (plans.length) {
        const dates = card('和同学的约定');
        for (const plan of plans) {
          const detail = element('p', plan.name + ' · ' + plan.label + ' · ' + plan.status + ' · ' + plan.text, 'student-meta');
          dates.append(detail);
          if (plan.status === '待赴约') {
            dates.append(group(isNear(plan.place)
              ? button('赴约', () => socialResult(social.joinPlan(plan.id, socialContext())))
              : button('前往' + plan.place, () => goTo(plan.place))));
          }
        }
        content.append(dates);
      }
      const requests = social.requests();
      if (requests.length) {
        const help = card('帮同学');
        for (const request of requests) {
          const message = request.label || request.title || request.text;
          help.append(element('p', message, 'student-meta'));
          if (request.status === '待帮忙') {
            const actions = [button('完成帮忙', () => socialResult(social.finishHelp(request.id, socialContext())),
              { disabled: Boolean(request.place && !isNear(request.place)) })];
            if (request.place && !isNear(request.place)) actions.unshift(button('前往' + request.place, () => goTo(request.place)));
            help.append(group(...actions));
          }
        }
        content.append(help);
      }
      const feed = card('班群消息');
      const messages = element('ul', undefined, 'student-list');
      for (const item of social.feed(socialContext())) messages.append(element('li', item.author + ' · ' + item.text));
      feed.append(messages);
      content.append(feed);
      const reputation = social.reputation?.();
      if (reputation) content.append(card('校园声望', reputation.label + ' · ' + reputation.score));
    }

    function showSocialMessage(peerId, message) {
      if (!message) return;
      const chat = card(message.name || '室友', message.text);
      chat.append(group(...(message.choices || []).map(choice => button(choice.label, () => {
        const reply = social.choose(peerId, choice.id, socialContext());
        render();
        showSocialMessage(peerId, reply);
      }))));
      content.prepend(chat);
      showNotice(message.notice);
    }

    function reportView() {
      const report = student.state.semesterReport;
      content.append(card(report ? '学期报告' : '课程成绩',
        report ? '平均分 ' + report.average + ' · 总绩点 ' + Number(report.gpa).toFixed(2)
          : '第 ' + calendar.examWeek + ' 周参加期末考试。所有已选课程交卷后生成最终报告。'));
      const grades = report?.courses || student.state.enrollment.map(id => student.grade(id)).filter(Boolean);
      for (const grade of grades) {
        const progress = card(grade.title, grade.difficulty
          ? (report ? '综合分 ' : '当前综合分 ') + Math.round(grade.score) + ' · 绩点 ' + Number(grade.gpa).toFixed(2) +
            ' · 期末难度 ' + difficultyNames[grade.difficulty]
          : '掌握度 ' + Math.round(grade.mastery) + '/100');
        const exam = grade.difficulty ? Math.round(grade.exam) : '待考';
        progress.append(element('p', '出勤 ' + Math.round(grade.attendance) + ' · 作业 ' + Math.round(grade.homework) +
          ' · 期末 ' + exam + '（出勤 20% · 作业 25% · 期末 55%）', 'student-meta'));
        progress.append(element('p', '准时 ' + grade.onTime + ' 次 · 迟到 ' + grade.late + ' 次 · 缺席 ' + grade.absent + ' 次', 'student-meta'));
        if (Number.isInteger(grade.homeworkCompleted)) {
          progress.append(element('p', '已交作业 ' + grade.homeworkCompleted + '/' + calendar.teachingWeeks +
            ' · 其中补交 ' + grade.homeworkLate + ' 份', 'student-meta'));
        }
        content.append(progress);
      }
      const achievements = card('成就');
      const unlocked = Object.values(student.state.achievements);
      const list = element('ul', undefined, 'student-list');
      for (const achievement of unlocked) {
        list.append(element('li', typeof achievement === 'string' ? (store.achievementNames?.[achievement] || achievement) : achievement.title));
      }
      if (!unlocked.length) list.append(element('li', '完成校园活动后可解锁成就。'));
      achievements.append(list);
      content.append(achievements);
      const previous = student.state.prototypeReport;
      if (previous?.courses?.length) {
        const archive = element('details', undefined, 'student-card student-archive');
        archive.append(element('summary', '五天试玩成绩'));
        const entries = element('ul', undefined, 'student-list');
        for (const course of previous.courses) {
          entries.append(element('li', course.title + ' · 综合分 ' + Math.round(course.score) + ' · 绩点 ' + Number(course.gpa).toFixed(2)));
        }
        archive.append(entries);
        content.append(archive);
      }
    }

    function profileView() {
      const current = student.state.profile;
      const profile = card('我的学生角色', '设置后会同步到校园角色。');
      const form = element('form', undefined, 'student-form');
      const fields = [
        ['name', '姓名', 'text'], ['shirt', '衣服颜色', 'color'], ['hair', '头发颜色', 'color'], ['skin', '肤色', 'color'],
      ];
      const inputs = {};
      for (const [key, label, type] of fields) {
        const field = element('label', label);
        const input = element('input');
        input.type = type;
        input.value = current[key];
        if (type === 'text') input.maxLength = 12;
        field.append(input);
        form.append(field);
        inputs[key] = input;
      }
      const apply = button('保存角色', () => stamp(student.updateProfile(Object.fromEntries(
        Object.entries(inputs).map(([key, input]) => [key, input.value])
      ))), { primary: true });
      form.addEventListener('submit', event => { event.preventDefault(); apply.click(); });
      form.append(group(apply, button('查看课表', () => show('schedule'))));
      profile.append(form);
      content.append(profile);
    }

    function crowdView() {
      const people = life.people || life.students;
      const counts = new Map();
      for (const person of people) {
        const label = person.destination || person.location;
        if (typeof label === 'string' && label) counts.set(label, (counts.get(label) || 0) + 1);
      }
      const overview = card('当前人流', (life.crowdActivity || life.phase) + ' · 地图上可见 ' + life.students.length + ' 人');
      const list = element('ul', undefined, 'student-list');
      for (const [name, count] of [...counts].sort((left, right) => right[1] - left[1]).slice(0, 6)) {
        list.append(element('li', name + ' · ' + count + ' 人'));
      }
      if (observedNpc) {
        const person = people.find(entry => entry.id === observedNpc);
        if (person) overview.append(element('p', person.name + ' · ' + (person.status || life.phase) +
          (typeof person.destination === 'string' ? ' · 去往' + person.destination : ''), 'student-meta'));
      }
      const audio = button(fanSound ? '关闭人流环境声' : '开启人流环境声', () => {
        fanSound = !fanSound;
        life.setAudioEnabled?.(fanSound);
        render();
      });
      const weather = element('select');
      weather.setAttribute('aria-label', '模拟天气');
      for (const [value, label] of [['clear', '晴'], ['rain', '雨'], ['snow', '雪']]) weather.add(new Option(label, value));
      weather.value = life.weather || 'clear';
      weather.addEventListener('change', () => {
        life.setWeather?.(weather.value);
        onChange(student.state.profile, isBike);
        render();
      });
      overview.append(list, group(audio, weather, button('刷新人流', render)));
      content.append(overview);
    }

    function locationView() {
      if (!place || !isNear(place)) {
        content.append(card('校园地点', '到达地点附近后，可以从地图上继续互动。'));
        return;
      }
      if (libraries.includes(place)) {
        const building = card(place, '到馆后可按科目自习。');
        building.append(group(...courses.filter(course => student.state.enrollment.includes(course.id))
          .map(course => button('自习 · ' + course.title, () => stamp(student.study(course.id))))));
        content.append(building);
      } else if (dining.includes(place)) {
        const building = card(place);
        building.append(group(button('吃一顿饭 · ¥' + store.foods.meal.price, () => stamp(student.eat('meal')), { primary: true }),
          button('买份零食 · ¥' + store.foods.snack.price, () => stamp(student.eat('snack'))),
          button('买日用品 · ¥' + store.supplies.price, () => stamp(student.buySupplies()))));
        content.append(building);
      } else if (place === dorm) {
        const building = card('学生公寓', '睡到第二天，恢复精力。');
        building.append(group(button('睡到明天', sleep, { primary: true }), button('看看室友的消息', () => {
          show('social');
          showSocialMessage(social.roommate().id, social.inviteRoommate(socialContext()));
        })));
        content.append(building);
      } else {
        const course = courses.find(item => item.landmark === place && student.state.enrollment.includes(item.id));
        if (!course) {
          content.append(card(place, '当前课表在这栋楼没有安排。'));
          return;
        }
        const current = student.currentSession(place);
        const next = current || student.schedule().find(session =>
          session.landmark === place && session.start > student.state.absoluteMinute);
        const building = card(place, course.room + ' · ' + course.teacher + ' · ' + course.title);
        if (next) {
          building.append(element('p', titleOfExamination(next) + ' · ' + clock(next.start), 'student-meta'));
          building.append(group(button(current?.kind === 'exam' ? '进入考场' : '进入教室', () => {
            roomPosition = { x: 192, y: 145 };
            show(current?.kind === 'exam' ? 'exam' : 'classroom', place);
          }, { primary: true })));
        } else {
          building.append(element('p', '这里今天没有待上的课程。', 'student-meta'));
        }
        content.append(building);
      }
    }

    function classView() {
      if (student.state.activeClass && student.state.activeClass.landmark !== place) {
        content.append(card('已有正在上的课程', '请回' + student.state.activeClass.landmark + '继续上课。'));
        return;
      }
      const standing = (life.people || []).filter(person => person.location === place && person.status?.includes('后排'));
      content.append(classroom(student.state.profile, roomPosition, standing));
      if (student.state.activeClass) {
        const lesson = student.state.activeClass;
        const room = card(lesson.title + ' · 第 ' + (lesson.segment + 1) + '/' + lesson.segments + ' 段',
          lesson.attendance === 'late' ? '已记录迟到，可以继续上课。' : '已准时到课。');
        const stage = ['概念讲解', '例题演示', '课堂小结'][lesson.segment];
        const recap = lesson.lesson?.text?.split('。')[0];
        const text = [lesson.lesson?.text, lesson.lesson?.example, recap ? recap + '。' : ''][lesson.segment];
        room.append(element('p', [stage, lesson.lesson?.title].filter(Boolean).join(' · '), 'student-meta'));
        room.append(element('p', text, 'student-lesson'));
        if (student.state.life.energy <= 25) room.append(element('p', '你有点犯困，这段课可以休息一会儿。', 'student-warning'));
        if (rollCall !== lesson.id) {
          room.append(group(button('点名 · 到', () => { rollCall = lesson.id; render(); showNotice('老师记下了你的回应。'); })));
        }
        const choices = group(
          button('认真听讲', () => stamp(student.takeClassSegment('learn')), { primary: true }),
          button('休息一会儿', () => stamp(student.takeClassSegment('rest'))),
          button('听完整节课', () => stamp(student.finishClass('learn'))),
        );
        const others = courses.filter(course => course.id !== lesson.courseId && student.state.enrollment.includes(course.id));
        if (others.length) {
          const subject = element('select');
          subject.setAttribute('aria-label', '要复习的科目');
          others.forEach(course => subject.add(new Option(course.title, course.id)));
          choices.append(subject, button('复习别科', () => stamp(student.takeClassSegment('review', subject.value))));
        }
        room.append(choices);
        content.append(room);
        return;
      }
      const current = student.currentSession(place);
      if (current?.kind === 'class') {
        const room = card(current.title, current.room + ' · ' + current.teacher);
        room.append(group(button('开始上课', () => stamp(student.startClass(current.id)), { primary: true })));
        content.append(room);
        return;
      }
      const next = student.schedule().find(session => session.landmark === place && session.start > student.state.absoluteMinute);
      const room = card('教室', next ? '本教室下一场 · ' + titleOfExamination(next) + ' · ' + clock(next.start) : '本节课堂已结束。');
      if (next) room.append(group(button('等到开始', () => {
        if (!advanceTo(next.start)) return;
        if (next.kind === 'exam') show('exam', place);
        else render();
      })));
      else if (current?.kind === 'exam') room.append(group(button('进入考场', () => show('exam', place))));
      content.append(room);
    }

    function examView() {
      const active = student.state.activeExam;
      if (active && active.landmark !== place) {
        content.append(card('已有进行中的期末考试', '请回' + active.landmark + '继续答题。'));
        return;
      }
      if (!active) {
        const session = student.currentSession(place);
        const exam = card(session?.kind === 'exam' ? titleOfExamination(session) : '期末考试',
          '开始考试时固定难度。这门课的掌握度越高，选到的题目越简单。');
        if (session?.kind === 'exam') {
          exam.append(group(button('开始考试', () => stamp(student.startExam(session.id)), { primary: true })));
        } else {
          exam.append(group(button('查看成绩', () => show('report'))));
        }
        content.append(exam);
        return;
      }
      const exam = card(titleOfExamination(active),
        '考前掌握度 ' + Math.round(active.masteryBefore) + ' · 当前难度 ' + difficultyNames[active.difficulty]);
      const form = element('form', undefined, 'student-exam');
      for (const [index, question] of active.questions.entries()) {
        const item = element('fieldset');
        item.append(element('legend', (index + 1) + '. ' + question.prompt));
        question.options.forEach((option, indexOfOption) => {
          const label = element('label', undefined, 'student-check');
          const input = element('input');
          input.type = 'radio';
          input.name = 'q' + index;
          input.value = String(indexOfOption);
          input.checked = student.state.examDraft[index] === indexOfOption;
          input.addEventListener('change', () => {
            student.state.examDraft[index] = indexOfOption;
            student.save();
          });
          label.append(input, document.createTextNode(option));
          item.append(label);
        });
        form.append(item);
      }
      form.append(group(button('交卷', () => {
        const selected = active.questions.map((_, index) => {
          const input = form.querySelector('input[name=q' + index + ']:checked');
          return input ? Number(input.value) : null;
        });
        if (selected.includes(null)) {
          showNotice('请为每一道题选择答案。');
          return;
        }
        const result = student.submitExam(selected);
        if (stamp(result)) {
          show('report');
          showNotice(result.message);
        }
      }, { primary: true })));
      exam.append(form);
      content.append(exam);
    }

    const renderers = { schedule: scheduleView, courses: coursesView, life: lifeView, social: socialView, report: reportView,
      profile: profileView, crowd: crowdView, location: locationView, classroom: classView, exam: examView };

    function render() {
      content.replaceChildren();
      tabs.hidden = !student || ['location', 'classroom', 'exam'].includes(tab);
      heading.textContent = { location: place, classroom: '学生课堂', exam: '期末考场' }[tab] || '学生手册';
      if (!student) {
        const intro = card('石大的一学期', '在唐岛湾度过 ' + calendar.teachingWeeks + ' 个教学周。上课、做每周作业、安排生活，第 ' +
          calendar.examWeek + ' 周参加期末考试。');
        intro.append(element('p', '课程、教室编号和生活费用为游戏设定。', 'student-meta'));
        intro.append(group(button('开始学生生活', activate, { primary: true })));
        content.append(intro);
        return;
      }
      tabs.replaceChildren(...panels.map(([value, label]) => {
        const option = button(label, () => show(value));
        option.setAttribute('aria-pressed', String(tab === value));
        return option;
      }));
      renderers[tab]();
    }

    byId('student-open').addEventListener('click', () => {
      if (!ready()) return;
      if (typeof window.AudioContext === 'function') {
        playBell.audio ??= new AudioContext();
        playBell.audio.resume().catch(() => {});
      }
      if (student?.state.activeExam && isNear(student.state.activeExam.landmark)) show('exam', student.state.activeExam.landmark);
      else if (student?.state.activeClass && isNear(student.state.activeClass.landmark)) show('classroom', student.state.activeClass.landmark);
      else {
        if (student) selectedDay = Math.min(student.dayIndex, lastCalendarDay);
        show('schedule');
      }
    });
    byId('student-close').addEventListener('click', () => dialog.close());
    const pauseButton = byId('student-clock-pause');
    const speedSelect = byId('student-clock-speed');
    pauseButton.addEventListener('click', () => {
      const paused = pauseButton.getAttribute('aria-pressed') !== 'true';
      pauseButton.setAttribute('aria-pressed', String(paused));
      pauseButton.textContent = paused ? '继续' : '暂停';
      life.setSpeed?.(paused ? 0 : Number(speedSelect.value));
    });
    speedSelect.addEventListener('change', () => {
      if (pauseButton.getAttribute('aria-pressed') !== 'true') life.setSpeed?.(Number(speedSelect.value));
    });

    if (student) buildSocial();
    return {
      get open() { return dialog.open; },
      get active() { return Boolean(student); },
      get profile() { return student?.state.profile; },
      get locationNames() { return namedLocations; },
      initialize() {
        if (student) {
          restorePosition(student.state.position);
          syncWorld();
        } else updateVitals();
      },
      tick,
      save() {
        if (!student) return;
        tick();
        student.state.position = getPosition();
        student.save();
      },
      openLocation(name) { show('location', name); },
      availableAt(name) {
        return Boolean(student && namedLocations.has(name));
      },
      talk(npc) {
        const peer = social?.peerFor(npc);
        if (!peer) return null;
        observedNpc = npc.id;
        return { peerId: peer.id || peer, dialogue: social.dialogue(peer.id || peer, socialContext()) };
      },
      choose(peerId, choiceId) {
        const result = social.choose(peerId, choiceId, socialContext());
        updateVitals();
        return result;
      },
      observe(npc) { observedNpc = npc.id; },
    };
  }

  window.PixelStudentUI = { create };
})();

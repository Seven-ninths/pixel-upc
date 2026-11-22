(() => {
  'use strict';

  const DAY = 1440;
  const DAYS_PER_WEEK = 7;
  const WEEK = DAY * DAYS_PER_WEEK;
  const TEACHING_WEEKS = 16;
  const EXAM_DAY = TEACHING_WEEKS * DAYS_PER_WEEK;
  const FIRST_MINUTE = 485;
  const STORAGE_KEY = 'pixel-upc-student-v1';
  const WEEKLY_ALLOWANCE = 180;
  const CLASS_SEGMENTS = 3;
  const REPORT_LIMIT = EXAM_DAY + DAYS_PER_WEEK;
  const calendar = Object.freeze({ teachingWeeks: TEACHING_WEEKS, examWeek: TEACHING_WEEKS + 1, examDayIndex: EXAM_DAY,
    daysPerWeek: DAYS_PER_WEEK, teachingDays: 4, dayMinutes: DAY });
  const DEFAULT_PROFILE = { name: '石大同学', shirt: '#50859a', hair: '#241e20', skin: '#e7ad7e' };
  const lifeDefaults = { energy: 92, hunger: 15, health: 90, allowance: WEEKLY_ALLOWANCE, mood: 76, stress: 20 };
  const foods = Object.freeze({
    meal: Object.freeze({ name: '正餐', price: 12, minutes: 20, hunger: -58, energy: 10, health: 3, mood: 4 }),
    snack: Object.freeze({ name: '零食', price: 5, minutes: 5, hunger: -23, energy: 5, health: 0, mood: 2 }),
  });
  const supplies = Object.freeze({ price: 8, minutes: 5, mood: 4 });
  const courses = Object.freeze([
    Object.freeze({ id: 'math', title: '高等数学', landmark: '南教楼', room: '南教 203', teacher: '沈景行' }),
    Object.freeze({ id: 'energy', title: '能源科学导论', landmark: '讲堂群', room: '南堂 120', teacher: '许知遥' }),
    Object.freeze({ id: 'programming', title: '程序设计基础', landmark: '工科楼A', room: 'A210', teacher: '顾闻舟' }),
  ]);
  const lessons = {
    math: [
      { title: '函数与代入', text: '函数给每个输入指定一个输出。把具体数值代入自变量，就能求出对应函数值。' },
      { title: '一次函数的变化率', text: '一次函数 y = kx + b 的斜率是 k。知道直线两点时，斜率等于纵坐标的变化量除以横坐标的变化量。' },
      { title: '交点与相等条件', text: '让两个函数用同一个 x 求出相同的 y，就找到了它们的交点。先令两个式子相等求 x，再代回其中一个式子求 y。' },
    ],
    energy: [
      { title: '功率与用电量', text: '用电量等于功率乘以用电时间。功率用千瓦、时间用小时，得到的用电量就是千瓦时。1000 瓦等于 1 千瓦。' },
      { title: '效率与热损失', text: '效率是有用输出能量与输入能量的比值。若输入 100 单位能量却只得到 80 单位有用能量，效率为 80%。' },
      { title: '多设备用电估算', text: '先把功率和时间换成统一单位，各设备的用电量分别计算后再相加。电费等于总用电量乘以每千瓦时价格。' },
    ],
    programming: [
      { title: '变量与赋值', text: '赋值先算等号右侧，再把结果放进左侧变量。旧的值可以参与右侧运算。' },
      { title: '条件分支', text: '条件成立时执行 if 分支，条件不成立时执行 else 分支。比较结果只有真或假。' },
      { title: '循环与累加', text: '每次进入循环都要重新检查条件。累加器可以在每轮保存目前的总和，循环结束后读到最终结果。' },
    ],
  };
  const questions = {
    math: {
      easy: [
        ['若 f(x) = 2x + 1，f(2) 等于多少？', ['3', '4', '5'], 2],
        ['直线 y = 3x + 4 的斜率是多少？', ['3', '4', '7'], 0],
        ['y = x 与 y = 6 的交点横坐标是多少？', ['0', '6', '12'], 1],
        ['曲线 y = x² 在 x = 3 处的切线斜率是多少？', ['3', '6', '9'], 1],
      ],
      medium: [
        ['若 f(x) = 4 − 2x，f(−3) 等于多少？', ['10', '2', '−2'], 0],
        ['直线通过 (1, 2) 和 (4, 8)，它的斜率是多少？', ['3', '6', '2'], 2],
        ['y = 2x + 3 与 y = x + 5 相交时，x 等于多少？', ['1', '2', '3'], 1],
        ['二次函数 f(x) = x² − 8x + 19 的最小值是多少？', ['4', '8', '3'], 2],
      ],
      hard: [
        ['若 f(x) = 3x − 2，则 f(f(2)) 等于多少？', ['12', '10', '4'], 1],
        ['一条线经过 (−2, 7) 和 (2, −1)。当 x = 0 时，y 等于多少？', ['−2', '4', '3'], 2],
        ['y = 3x − 2 与 y = −x + 6 的交点在哪里？', ['(2, 4)', '(4, 2)', '(3, 7)'], 0],
        ['把 2x − 1 从 x = 1 积分到 x = 3，结果是多少？', ['6', '8', '9'], 0],
      ],
    },
    energy: {
      easy: [
        ['用电量等于以下哪一项？', ['功率 × 用电时间', '功率 ÷ 用电时间', '功率 + 用电时间'], 0],
        ['1000 瓦等于多少千瓦？', ['0.1', '1', '10'], 1],
        ['输入 100 单位能量，有用输出为 80 单位，效率是多少？', ['20%', '100%', '80%'], 2],
        ['热泵用 2.5 千瓦时电输送 7.5 千瓦时热量，性能系数 COP 是多少？', ['2', '5', '3'], 2],
      ],
      medium: [
        ['一台 500 瓦电器工作 3 小时，用电量是多少？', ['0.5 千瓦时', '1.5 千瓦时', '15 千瓦时'], 1],
        ['设备输入 200 单位能量，效率为 75%，有用输出是多少？', ['125', '175', '150'], 2],
        ['设备总计消耗 4 千瓦时，电价 0.6 元/千瓦时，电费是多少？', ['2.4 元', '4.6 元', '6 元'], 0],
        ['储能设备充入 15 千瓦时，最后放出 10.8 千瓦时。往返效率是多少？', ['72%', '28%', '64%'], 0],
      ],
      hard: [
        ['600 瓦设备用 30 分钟，200 瓦设备用 2 小时，总用电是多少？', ['0.5 千瓦时', '0.7 千瓦时', '1 千瓦时'], 1],
        ['效率是 60%，有用输出是 120 单位，输入是多少？', ['200', '192', '180'], 0],
        ['800 瓦空调开 45 分钟，100 瓦灯开 2 小时，电价 0.8 元/千瓦时。共花多少？', ['0.8 元', '0.56 元', '0.64 元'], 2],
        ['8 平方米光伏板以 25% 效率在 0.65 千瓦/平方米的光照下工作 3 小时。电量全部经过往返效率 80% 的储能，最终可用多少电？', ['3.9 千瓦时', '3.12 千瓦时', '4.88 千瓦时'], 1],
      ],
    },
    programming: {
      easy: [
        ['x 初始为 2。执行 x = x + 3 后，x 是多少？', ['2', '3', '5'], 2],
        ['if 的条件不成立时，执行哪个分支？', ['if', 'else', '两个分支都执行'], 1],
        ['total 从 0 开始，每轮加 2，共 3 轮。最终是多少？', ['6', '5', '8'], 0],
        ['函数 double(x) 返回 2 × x。调用 double(4) 会返回多少？', ['8', '6', '4'], 0],
      ],
      medium: [
        ['先令 x = 4，再执行 y = x + 1 和 x = 2。最后 y 是多少？', ['5', '2', '3'], 0],
        ['score = 59。条件 score ≥ 60 时通过，否则补交。结果如何？', ['通过', '通过并补交', '补交'], 2],
        ['total 从 0 开始，依次把 1、2、3 加进去。最终是多少？', ['3', '6', '9'], 1],
        ['按条件 n ≥ 5 筛选列表 [2, 4, 5, 8]，新列表有几个元素？', ['1', '2', '3'], 1],
      ],
      hard: [
        ['令 x = 3、y = 5。先令 x = y − x，再令 y = x + y。最后 y 是多少？', ['7', '8', '3'], 0],
        ['i 从 1 加到 5。只有 i 大于 2 时才将它加入 total。total 从 0 开始，最终是多少？', ['9', '12', '15'], 1],
        ['i 和 total 都从 1 开始。每轮先给 total 加 i，再给 i 加 2。条件为 i < 6。最终 total 是多少？', ['9', '11', '10'], 2],
        ['f(x) 在 x < 4 时返回 2 × x，否则返回 x − 1。依次处理 [2, 4, 6] 并累加返回值，总和是多少？', ['11', '13', '12'], 2],
      ],
    },
  };
  const classExamples = {
    math: [
      '例如 f(x) = 2x + 1，把 x 换成 3，得到 f(3) = 7。',
      '从 (1, 3) 到 (3, 7)，横坐标增了 2，纵坐标增了 4，斜率是 4 ÷ 2 = 2。',
      '求 y = 2x + 1 和 y = x + 4 的交点，令两个式子相等，得 x = 3、y = 7。',
    ],
    energy: [
      '500 瓦是 0.5 千瓦，一台 500 瓦设备使用 2 小时，消耗 1 千瓦时。',
      '有用输出 60，效率是 75%，反推输入需要 60 ÷ 0.75 = 80。',
      '一台 400 瓦设备用半小时是 0.2 千瓦时，再加上另一台设备的 0.3 千瓦时，总消耗是 0.5 千瓦时。',
    ],
    programming: [
      'x 原来是 4，执行 x = x + 2，先用旧值算出 6，最后 x 才变成 6。',
      '若设定分数达到 60 就通过，59 分会走 else 分支，60 分会走 if 分支。',
      'total 从 0 开始，依次加 2、4、6，三轮的结果分别是 2、6、12。',
    ],
  };
  const practiceExamples = [
    classExamples,
    {
      math: [
        '借书柜剩余空格 f(x) = 40 − x。放入 12 本书后，剩下 f(12) = 28 个空格。',
        '打印 4 张花 2 元，打印 10 张花 5 元。用两点之差求得每张 0.5 元。',
        '两种打印卡收费分别为 y = 5 + 0.5x 和 y = 0.75x。令收费相等，得到 x = 20 张。',
      ],
      energy: [
        '两台各 45 瓦的风扇同时开 4 小时：总功率 0.09 千瓦，用电 0.36 千瓦时。',
        '若电动机输入 250 单位能量，传给设备的只有 200 单位，则效率是 80%，剩余 50 单位转为其他形式的能量。',
        '宿舍一盏 15 瓦台灯开 2 小时，一台 65 瓦笔记本电脑开 4 小时。总用电为 0.03 + 0.26 = 0.29 千瓦时。',
      ],
      programming: [
        '把已借图书数记作 borrowed。还书时先计算 borrowed − 1，再把结果写回 borrowed。',
        '同时满足“仍有库存”和“已经登记”才借出器材。只有一个条件成立时，就走不借出的分支。',
        '把三天步数 3000、4000、5000 依次加入 total。每一天都用上一次的总数，最后得到 12000。',
      ],
    },
    {
      math: [
        'f(x) = 3x − 1 时，f(f(2)) 要从里面算起。先得到 f(2) = 5，再得到 f(5) = 14。',
        '从 (−1, 5) 到 (3, −3)，纵坐标变化 −8，横坐标变化 4，所以斜率是 −2。',
        'y = 2x + 1 和 y = 2x + 4 的斜率相同、截距不同。令式子相等得到矛盾，两条直线没有交点。',
      ],
      energy: [
        '一台 1.8 千瓦电热壶烧水 5 分钟。先除以 60 换算成小时，再乘功率，得到 0.15 千瓦时。',
        '一台装置的效率为 60%。要得到 90 单位有用输出，输入应为 90 ÷ 0.6 = 150 单位。',
        '两台设备分别用电 0.8 和 1.2 千瓦时。若电价为每千瓦时 0.7 元，电费共 1.4 元。',
      ],
      programming: [
        'x = 2、y = 5 时执行 x = y − x，再执行 y = x + y。第二句使用新的 x，因此最后 y = 8。',
        '优先判断是否达到 90 分，再判断是否达到 60 分。85 分会跳过第一项，进入“通过”分支。',
        'i 从 1 开始，每轮先把 i 加入 total，再令 i = i + 2。只要 i < 6 就继续，因此加入的是 1、3、5。',
      ],
    },
    {
      math: [
        '自查输入与输出的方向：给定 f(x) = 2x − 3，求 f(−2) 要把负数整体代入，得到 −7。',
        '已知斜率 −2 且直线过 (2, 5)。代入 y = −2x + b 得 b = 9，所以 y 轴交点是 (0, 9)。',
        '令 y = 4x − 1 与 y = x + 8 相等，求出 x = 3 后还要回代，最后才得到交点 (3, 11)。',
      ],
      energy: [
        '自查单位：300 瓦台灯使用 40 分钟，应该算 0.3 × (40 ÷ 60) = 0.2 千瓦时。',
        '输入 80 单位，有用输出 50 单位。效率用 50 除以 80，得到 62.5%，而不是用损失量直接当效率。',
        '三天每天各用电 0.2 和 0.3 千瓦时。先按天相加，再乘三天，最后按总量计费。',
      ],
      programming: [
        '依次记下每句执行后的状态：x = 4；y = x；x = x − 1。最后 x 为 3，y 仍为 4。',
        '看清大于和大于等于：人数等于 20 时，条件“人数 < 20”不成立。',
        '把 i = 1 到 5 中大于 3 的数加入总和。逐轮检查条件，只加入 4 和 5，得到 9。',
      ],
    },
  ];
  const teachingUnits = ['基础概念', '校园实例', '进阶应用', '期末梳理'];
  const timetable = [
    [['math', 530], ['energy', 595], ['programming', 840]],
    [['energy', 530], ['programming', 595], ['math', 840]],
    [['math', 595], ['energy', 840]],
    [['programming', 530]],
  ];
  const courseIds = courses.map(course => course.id);
  function makeSession(courseId, time, dayIndex, kind, lesson = null) {
    const { title, landmark, room, teacher } = courses.find(course => course.id === courseId);
    const start = dayIndex * DAY + time;
    return {
      id: `${dayIndex}:${courseId}`, courseId, title, landmark, room, teacher, dayIndex,
      week: Math.floor(dayIndex / DAYS_PER_WEEK) + 1, weekday: dayIndex % DAYS_PER_WEEK,
      start, end: start + 45, kind, lesson,
    };
  }
  const classSessions = Array.from({ length: TEACHING_WEEKS }, (_, weekIndex) => {
    const lessonIndexes = { math: 0, energy: 0, programming: 0 };
    const unitIndex = Math.floor(weekIndex / 4);
    return timetable.flatMap((slots, weekday) => slots.map(([courseId, time]) => {
      const lessonIndex = lessonIndexes[courseId]++;
      const outline = window.PixelStudentLectureContent?.[courseId]?.[weekIndex];
      const lesson = {
        ...lessons[courseId][lessonIndex], unit: teachingUnits[unitIndex], example: practiceExamples[unitIndex][courseId][lessonIndex],
        ...(outline?.unit ? { unit: outline.unit } : {}), ...outline?.lessons?.[lessonIndex],
      };
      return makeSession(courseId, time, weekIndex * DAYS_PER_WEEK + weekday, 'class', lesson);
    }));
  }).flat();
  const examSessions = timetable[0].map(([courseId, time]) => makeSession(courseId, time, EXAM_DAY, 'exam'));
  const sessions = [...classSessions, ...examSessions];
  const sessionsById = new Map(sessions.map(session => [session.id, session]));
  const sessionsByDay = Array.from({ length: EXAM_DAY + 1 }, () => []);
  for (const session of sessions) sessionsByDay[session.dayIndex].push(session);
  const classesByCourse = Object.fromEntries(courseIds.map(id => [id, classSessions.filter(session => session.courseId === id)]));
  const firstClass = classSessions[0].start;

  const clamp = (value, low = 0, high = 100) => Math.min(high, Math.max(low, value));
  const round = value => Math.round(value * 100) / 100;
  const dayOf = minute => Math.floor(minute / DAY);
  const weekOf = minute => Math.floor(minute / WEEK) + 1;
  const fail = message => ({ ok: false, message });
  const succeed = (message, extra = {}) => ({ ok: true, message, ...extra });
  const plainObject = value => value && typeof value === 'object' && !Array.isArray(value);
  const hexColor = value => typeof value === 'string' && /^#[a-f\d]{6}$/i.test(value);

  function storageFor(options) {
    try {
      return Object.hasOwn(options, 'storage') ? options.storage : window.localStorage;
    } catch {
      return null;
    }
  }

  function load(storage) {
    try {
      const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
      return [1, 2].includes(saved?.version) && plainObject(saved.state) && Number.isSafeInteger(saved.state.absoluteMinute)
        && saved.state.absoluteMinute >= 0 ? saved : null;
    } catch {
      return null;
    }
  }

  function profileWith(profile, changes) {
    const result = { ...profile };
    if (typeof changes.name === 'string' && changes.name.trim()) result.name = Array.from(changes.name.trim()).slice(0, 16).join('');
    for (const key of ['shirt', 'hair', 'skin']) if (hexColor(changes[key])) result[key] = changes[key];
    return result;
  }

  function difficultyFor(mastery) {
    if (mastery >= 70) return 'easy';
    if (mastery >= 40) return 'medium';
    return 'hard';
  }

  function examFor(session, masteryBefore) {
    const difficulty = difficultyFor(masteryBefore);
    return {
      ...session, status: 'active', difficulty, masteryBefore,
      questions: questions[session.courseId][difficulty].map(([prompt, options], index) => ({
        id: `${session.courseId}:${difficulty}:${index}`, prompt, options: [...options],
      })),
    };
  }

  function pointFor(score) {
    return [[90, 4], [85, 3.7], [80, 3.3], [75, 3], [70, 2.7], [65, 2.3], [60, 2]]
      .find(([minimum]) => score >= minimum)?.[1] ?? 0;
  }

  function create(options = {}) {
    const storage = storageFor(options);
    const envelope = load(storage);
    const saved = envelope?.state;
    const migrating = envelope?.version === 1;
    const start = Number.isFinite(options.startMinute) ? clamp(Math.floor(options.startMinute), 0, DAY - 1) : FIRST_MINUTE;
    const savedDay = dayOf(saved?.absoluteMinute ?? start);
    // Days spent exploring after the prototype's Friday finals belong to its
    // history. Resume at the end of the first teaching week in the new term.
    const migrationShift = migrating ? Math.max(0, savedDay - (DAYS_PER_WEEK - 1)) * DAY : 0;
    const enrollment = courseIds.filter(id => Array.isArray(saved?.enrollment) && saved.enrollment.includes(id));
    const dailyReports = Array.isArray(saved?.dailyReports) ? saved.dailyReports.filter(plainObject) : [];
    const state = {
      absoluteMinute: (saved?.absoluteMinute ?? start) - migrationShift,
      profile: profileWith(DEFAULT_PROFILE, saved?.profile ?? {}),
      life: Object.fromEntries(Object.entries(lifeDefaults).map(([key, value]) => [key,
        Number.isFinite(saved?.life?.[key]) ? clamp(saved.life[key], 0, key === 'allowance' ? Infinity : 100) : value])),
      enrollment: enrollment.length ? enrollment : [...courseIds],
      mastery: Object.fromEntries(courseIds.map(id => [id, clamp(Number.isFinite(saved?.mastery?.[id]) ? saved.mastery[id] : 14)])),
      attendance: {}, homework: Object.fromEntries(courseIds.map(id => [id, {}])), exams: {}, activeClass: null, activeExam: null,
      dailyReports: (migrating ? dailyReports.filter(report => report.dayIndex < DAYS_PER_WEEK) : dailyReports).slice(-REPORT_LIMIT),
      semesterReport: null,
      prototypeReport: migrating ? saved?.semesterReport ?? null : saved?.prototypeReport ?? null,
      prototypeExams: migrating ? saved?.exams ?? {} : saved?.prototypeExams ?? {},
      prototypeDailyReports: migrating ? dailyReports : saved?.prototypeDailyReports ?? [],
      prototypeExamDraft: migrating && saved?.activeExam ? { exam: saved.activeExam, answers: saved.examDraft ?? [] } : saved?.prototypeExamDraft ?? null,
      prototypeAchievements: migrating ? {} : saved?.prototypeAchievements ?? {},
      achievements: {},
      social: plainObject(saved?.social) ? saved.social : null,
      position: Number.isFinite(saved?.position?.x) && Number.isFinite(saved?.position?.y)
        && ['up', 'down', 'left', 'right'].includes(saved.position.dir) ? saved.position : null,
      examDraft: [],
    };
    let attendanceCursor = 0;
    const isEnrolled = session => state.enrollment.includes(session.courseId);
    const daySessions = dayIndex => (sessionsByDay[dayIndex] ?? []).filter(isEnrolled);
    const findSession = id => {
      const session = sessionsById.get(id);
      return session && isEnrolled(session) ? session : null;
    };
    const titleFor = id => courses.find(course => course.id === id)?.title;

    function save() {
      try {
        if (!storage) return false;
        storage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, state }));
        return true;
      } catch {
        return false;
      }
    }

    function adjust(changes) {
      for (const [key, value] of Object.entries(changes)) {
        state.life[key] = clamp(state.life[key] + value, 0, key === 'allowance' ? Infinity : 100);
      }
    }

    function unlock(id, title) {
      if (!state.achievements[id]) state.achievements[id] = { id, title, earnedAt: state.absoluteMinute };
    }

    function attendanceCounts(list) {
      const values = list.map(session => state.attendance[session.id]);
      return {
        onTime: values.filter(value => value === 'on-time').length,
        late: values.filter(value => value === 'late').length,
        absent: values.filter(value => value === 'absent').length,
      };
    }

    function homework(courseId, week = Math.min(weekOf(state.absoluteMinute), TEACHING_WEEKS)) {
      if (!state.enrollment.includes(courseId) || !Number.isInteger(week) || week < 1 || week > TEACHING_WEEKS) return null;
      const availableAt = (week - 1) * WEEK + firstClass;
      const dueAt = week * WEEK;
      const work = state.homework[courseId][week];
      let status = 'available';
      if (work) status = work.score === 100 ? 'completed' : 'late';
      else if (state.exams[courseId]) status = 'missed';
      else if (state.absoluteMinute >= dueAt) status = 'overdue';
      else if (state.absoluteMinute < availableAt) status = 'upcoming';
      return { courseId, week, availableAt, dueAt, completedAt: work?.completedAt ?? null, score: work?.score ?? null, status };
    }

    function grade(courseId) {
      if (!state.enrollment.includes(courseId)) return null;
      const { onTime, late, absent } = attendanceCounts(classesByCourse[courseId]);
      const attendanceTotal = onTime + late + absent;
      const attendance = attendanceTotal ? round(100 * (onTime + late * 0.6) / attendanceTotal) : 0;
      const work = Object.values(state.homework[courseId]);
      const expiredWeeks = Math.min(TEACHING_WEEKS, weekOf(state.absoluteMinute) - 1);
      const homeworkTotal = expiredWeeks + Object.keys(state.homework[courseId]).filter(week => Number(week) > expiredWeeks).length;
      const homeworkScore = homeworkTotal ? round(work.reduce((sum, item) => sum + item.score, 0) / homeworkTotal) : 0;
      const exam = state.exams[courseId]?.score ?? 0;
      const score = round(attendance * 0.2 + homeworkScore * 0.25 + exam * 0.55);
      return {
        id: courseId, title: titleFor(courseId), attendance, homework: homeworkScore, exam, score, gpa: pointFor(score),
        mastery: state.mastery[courseId], difficulty: state.exams[courseId]?.difficulty ?? null, onTime, late, absent, attendanceTotal,
        homeworkTotal, homeworkCompleted: work.length, homeworkLate: work.filter(item => item.score < 100).length,
        homeworkMissed: homeworkTotal - work.length,
      };
    }

    function compileReport() {
      const results = state.enrollment.map(grade);
      return {
        dayIndex: dayOf(state.absoluteMinute), week: weekOf(state.absoluteMinute), absoluteMinute: state.absoluteMinute,
        gpa: round(results.reduce((sum, result) => sum + result.gpa, 0) / results.length),
        average: round(results.reduce((sum, result) => sum + result.score, 0) / results.length),
        courses: results,
      };
    }

    function dayReport(dayIndex) {
      const classes = attendanceCounts(daySessions(dayIndex).filter(session => session.kind === 'class'));
      const homeworkDone = state.enrollment.filter(id => Object.values(state.homework[id]).some(work => dayOf(work.completedAt) === dayIndex));
      const examsDone = state.enrollment.filter(id => state.exams[id] && dayOf(state.exams[id].submittedAt) === dayIndex);
      return {
        dayIndex, absoluteMinute: state.absoluteMinute, life: { ...state.life }, classes,
        homework: homeworkDone, exams: examsDone,
      };
    }

    function settleClasses() {
      while (classSessions[attendanceCursor]?.end <= state.absoluteMinute) {
        const session = classSessions[attendanceCursor++];
        if (isEnrolled(session) && !state.attendance[session.id]) state.attendance[session.id] = 'absent';
      }
      if (state.activeClass?.end <= state.absoluteMinute) state.activeClass = null;
    }

    function advance(minute, asleep = false) {
      if (!Number.isFinite(minute)) return state;
      const target = Math.min(Math.floor(minute), Number.MAX_SAFE_INTEGER - DAY);
      while (state.absoluteMinute < target) {
        const dayIndex = dayOf(state.absoluteMinute);
        const midnight = (dayIndex + 1) * DAY;
        const next = Math.min(target, midnight);
        const hours = Math.floor(next / 60) - Math.floor(state.absoluteMinute / 60);
        if (hours && !asleep) adjust({ hunger: 5 * hours, energy: -2 * hours });
        state.absoluteMinute = next;
        settleClasses();
        if (next === midnight) {
          if (state.life.hunger >= 85) adjust({ health: -5, mood: -4 });
          if (state.life.energy <= 15) adjust({ health: -4, stress: 4 });
          state.dailyReports.push(dayReport(dayIndex));
          if (state.dailyReports.length > REPORT_LIMIT) state.dailyReports.shift();
          if ((dayIndex + 1) % DAYS_PER_WEEK === 0) adjust({ allowance: WEEKLY_ALLOWANCE });
        }
      }
      return state;
    }

    function sync(minute) {
      const before = state.absoluteMinute;
      advance(minute);
      if (state.absoluteMinute !== before) save();
      return state;
    }

    function fastForward(minute) {
      const busy = checkFreeTime();
      if (busy) return busy;
      if (!Number.isSafeInteger(minute) || minute <= state.absoluteMinute) return fail('请选择晚于当前时间的时刻。');
      sync(minute);
      return succeed('时间已推进。', { advanceTo: state.absoluteMinute });
    }

    function describe(session) {
      const active = session.kind === 'class' ? state.activeClass : state.activeExam;
      const attendance = state.attendance[session.id] ?? null;
      let status = 'upcoming';
      if (active?.id === session.id) status = 'active';
      else if (session.kind === 'exam' && state.exams[session.courseId]) status = 'completed';
      else if (attendance) status = attendance === 'absent' ? 'missed' : 'completed';
      else if (state.absoluteMinute >= session.start - (session.kind === 'class' ? 15 : 0)) status = 'available';
      return { ...session, attendance, status };
    }

    function schedule(dayIndex = dayOf(state.absoluteMinute)) {
      return daySessions(dayIndex).map(describe);
    }

    function currentSession(landmark) {
      const matches = session => session && (!landmark || session.landmark === landmark);
      const active = state.activeClass ?? state.activeExam;
      if (matches(active)) return describe(active);
      const current = schedule().find(session => matches(session) && session.status === 'available' && session.end > state.absoluteMinute);
      return current ?? examSessions.filter(session => isEnrolled(session) && matches(session)).map(describe)
        .find(session => session.status === 'available') ?? null;
    }

    function nextUpcomingSession() {
      const found = sessions.find(session => session.start > state.absoluteMinute && isEnrolled(session));
      return found ? describe(found) : null;
    }

    function nextSession() {
      const active = state.activeClass ?? state.activeExam;
      if (active) return describe(active);
      const today = schedule().find(session => ['available', 'upcoming'].includes(session.status) && session.end > state.absoluteMinute);
      return today ?? nextUpcomingSession() ?? examSessions.filter(isEnrolled).map(describe)
        .find(session => session.status === 'available') ?? null;
    }

    function updateProfile(changes = {}) {
      state.profile = profileWith(state.profile, changes ?? {});
      save();
      return succeed('学生资料已保存。');
    }

    function setEnrollment(ids) {
      if (state.absoluteMinute >= firstClass || state.activeClass) return fail('本学期第一节课开始后，选课已锁定。');
      if (!Array.isArray(ids) || !ids.length || ids.some(id => !courseIds.includes(id))) return fail('请选择至少一门课程。');
      state.enrollment = courseIds.filter(id => ids.includes(id));
      save();
      return succeed(`已选 ${state.enrollment.length} 门课程。`);
    }

    function startClass(sessionId) {
      if (state.activeClass || state.activeExam) return fail('请先完成当前课堂或考试。');
      const session = findSession(sessionId);
      if (session?.kind !== 'class' || describe(session).status !== 'available') return fail('这节课目前无法进入。');
      const arrival = state.absoluteMinute;
      const attendance = arrival <= session.start ? 'on-time' : 'late';
      const segmentLength = (session.end - session.start) / CLASS_SEGMENTS;
      const segment = clamp(Math.floor((arrival - session.start) / segmentLength), 0, CLASS_SEGMENTS - 1);
      state.attendance[session.id] = attendance;
      state.activeClass = { ...session, status: 'active', arrival, attendance, segment, segments: CLASS_SEGMENTS };
      if (attendance === 'late') adjust({ stress: 4 });
      if (attendance === 'on-time') unlock('on-time', '第一次准时上课');
      advance(session.start);
      save();
      return succeed(attendance === 'late' ? '已入场，记为迟到。' : '已到课，准备开始。', { advanceTo: state.absoluteMinute });
    }

    function progressClass(mode, reviewId, finish) {
      const active = state.activeClass;
      if (!active) return fail('当前没有正在上的课程。');
      if (!['learn', 'rest', 'review'].includes(mode)) return fail('请选择听讲、休息或复习另一门课程。');
      if (mode === 'review' && (!state.enrollment.includes(reviewId) || reviewId === active.courseId)) {
        return fail('请选择另一门已选课程。');
      }
      const count = finish ? active.segments - active.segment : 1;
      let tiredWhileLearning = false;
      for (let step = 0; step < count; step++) {
        if (mode === 'rest') {
          adjust({ energy: 5, stress: -2, mood: 1 });
        } else {
          const tired = state.life.energy < 25;
          const id = mode === 'learn' ? active.courseId : reviewId;
          const gain = mode === 'learn' ? 0.55 : 0.4;
          state.mastery[id] = round(clamp(state.mastery[id] + gain * (tired ? 0.55 : 1)));
          adjust({ energy: -3, stress: 1 });
          tiredWhileLearning ||= tired;
        }
        active.segment++;
        advance(active.start + (active.end - active.start) * active.segment / active.segments);
      }
      const completed = active.segment >= active.segments;
      save();
      const actionText = mode === 'rest' ? '休息恢复了精力。' : `${mode === 'learn' ? '听讲' : '复习'}提升了掌握度。`;
      const fatigue = tiredWhileLearning ? '精力不足，掌握度收益降低。' : '';
      return succeed(`${completed ? '本节课结束。' : ''}${actionText}${fatigue}`, { advanceTo: state.absoluteMinute, completed });
    }

    function checkFreeTime() {
      return state.activeClass || state.activeExam ? fail('请先完成当前课堂或考试。') : null;
    }

    function doHomework(courseId, week) {
      const busy = checkFreeTime();
      if (busy) return busy;
      const work = homework(courseId, week);
      if (!work) return fail('没有找到这周的课程作业。');
      if (work.status === 'missed') return fail('该课程考试已提交，作业已截止。');
      if (work.completedAt !== null) return fail('这门课本周的作业已经完成。');
      if (work.status === 'upcoming') return fail('这周的作业还未开放。');
      if (state.life.energy < 12) return fail('精力不足，休息或吃点东西再写作业。');
      const completedAt = state.absoluteMinute + 30;
      const score = completedAt <= work.dueAt ? 100 : 70;
      state.homework[courseId][work.week] = { completedAt, score };
      adjust({ energy: -12 });
      unlock('first-homework', '第一份课程作业');
      if (state.enrollment.every(id => Object.keys(state.homework[id]).length === TEACHING_WEEKS)) {
        unlock('homework-complete', '完成全学期课程作业');
      }
      advance(completedAt);
      save();
      const message = score === 100 ? '作业已完成。' : '已补交作业，计 70 分。';
      return succeed(`${titleFor(courseId)}第 ${work.week} 周${message}`, { advanceTo: state.absoluteMinute, homework: homework(courseId, work.week) });
    }

    function study(courseId) {
      const busy = checkFreeTime();
      if (busy) return busy;
      if (!state.enrollment.includes(courseId)) return fail('请先选择这门课程。');
      if (state.life.energy < 9) return fail('精力不足，先休息再自习。');
      const tired = state.life.energy < 25;
      state.mastery[courseId] = round(clamp(state.mastery[courseId] + (tired ? 0.9 : 1.8)));
      adjust({ energy: -9, stress: 2 });
      advance(state.absoluteMinute + 30);
      unlock('first-study', '第一次课外自习');
      save();
      return succeed(tired ? '自习结束。精力不足，掌握度收益降低。' : '自习结束，科目掌握度提高。', { advanceTo: state.absoluteMinute });
    }

    function spendTime(minutes, energy = 0) {
      const busy = checkFreeTime();
      if (busy) return busy;
      if (!Number.isFinite(minutes) || minutes < 0 || minutes > DAY || !Number.isFinite(energy)) return fail('活动时间或精力变化无效。');
      adjust({ energy });
      advance(state.absoluteMinute + Math.ceil(minutes));
      save();
      return succeed('活动已完成。', { advanceTo: state.absoluteMinute });
    }

    function eat(kind) {
      const busy = checkFreeTime();
      if (busy) return busy;
      if (!Object.hasOwn(foods, kind)) return fail('请选择正餐或零食。');
      const { name, price, minutes, hunger, energy, health, mood } = foods[kind];
      if (state.life.allowance < price) return fail('生活费不足。');
      adjust({ allowance: -price, hunger, energy, health, mood });
      advance(state.absoluteMinute + minutes);
      if (kind === 'meal') unlock('first-meal', '尝过校园食堂');
      save();
      return succeed(`吃了${name}，花费 ${price} 元。`, { advanceTo: state.absoluteMinute });
    }

    function buySupplies() {
      const busy = checkFreeTime();
      if (busy) return busy;
      if (state.life.allowance < supplies.price) return fail('生活费不足。');
      adjust({ allowance: -supplies.price, mood: supplies.mood });
      advance(state.absoluteMinute + supplies.minutes);
      save();
      return succeed(`买了一份日用品，花费 ${supplies.price} 元。`, { advanceTo: state.absoluteMinute });
    }

    function sleep() {
      const busy = checkFreeTime();
      if (busy) return busy;
      const dayIndex = dayOf(state.absoluteMinute) + 1;
      advance(dayIndex * DAY + FIRST_MINUTE, true);
      adjust({ energy: 90, hunger: 18, health: 5, mood: 8, stress: -20 });
      save();
      return succeed('睡了一觉。新的一天从 08:05 开始。', { dayIndex, advanceTo: state.absoluteMinute, report: state.dailyReports.at(-1) });
    }

    function startExam(sessionId) {
      const busy = checkFreeTime();
      if (busy) return busy;
      const session = findSession(sessionId);
      if (session?.kind !== 'exam' || describe(session).status !== 'available') return fail('这门课的考试目前无法进入。');
      state.activeExam = examFor(session, state.mastery[session.courseId]);
      state.examDraft = [];
      save();
      return succeed('考试开始，题目难度已按当前掌握度确定。');
    }

    function submitExam(answers) {
      const active = state.activeExam;
      if (!active) return fail('当前没有进行中的考试。');
      const bank = questions[active.courseId][active.difficulty];
      if (!Array.isArray(answers) || answers.length !== bank.length
        || bank.some(([, choices], index) => answers[index] != null && (!Number.isInteger(answers[index]) || answers[index] < 0 || answers[index] >= choices.length))) {
        return fail('请提交这场考试的答题选项。');
      }
      const correct = bank.filter(([, , answer], index) => answers[index] === answer).length;
      const score = round(100 * correct / bank.length);
      const submittedAt = state.absoluteMinute + 20;
      state.exams[active.courseId] = { submittedAt, score, difficulty: active.difficulty, masteryBefore: active.masteryBefore, correct, total: bank.length };
      state.activeExam = null;
      state.examDraft = [];
      adjust({ energy: -10, stress: -4 });
      advance(submittedAt);
      unlock('first-exam', '完成第一门期末考试');
      if (state.enrollment.every(id => state.exams[id])) {
        state.semesterReport = compileReport();
        unlock('semester-finished', '完成本学期');
        if (state.semesterReport.average >= 85) unlock('honors', '学期成绩优秀');
      }
      save();
      const result = { correct, total: bank.length, score, difficulty: active.difficulty };
      return succeed(`考试结束，答对 ${correct}/${bank.length}，卷面 ${score} 分。`, {
        ...result, result, advanceTo: state.absoluteMinute, semesterReport: state.semesterReport,
      });
    }

    for (const session of classSessions.filter(isEnrolled)) {
      const value = saved?.attendance?.[session.id];
      if (['on-time', 'late', 'absent'].includes(value)) state.attendance[session.id] = value;
    }
    for (const id of state.enrollment) {
      const work = saved?.homework?.[id];
      if (migrating && Number.isSafeInteger(work?.completedAt) && work.score === 100) {
        state.homework[id][1] = { ...work, completedAt: Math.min(work.completedAt, state.absoluteMinute) };
      } else if (plainObject(work)) {
        for (const [week, record] of Object.entries(work)) {
          if (Number.isInteger(Number(week)) && Number(week) >= 1 && Number(week) <= TEACHING_WEEKS
            && Number.isSafeInteger(record?.completedAt) && [70, 100].includes(record.score)) {
            state.homework[id][Number(week)] = record;
          }
        }
      }
      const exam = saved?.exams?.[id];
      if (!migrating && Number.isSafeInteger(exam?.submittedAt) && Number.isFinite(exam.score)
        && Object.hasOwn(questions[id], exam.difficulty)) state.exams[id] = exam;
    }
    if (plainObject(saved?.achievements)) {
      state.achievements = { ...saved.achievements };
      if (migrating) {
        for (const id of ['first-exam', 'semester-finished', 'honors', 'homework-complete']) {
          if (state.achievements[id]) state.prototypeAchievements[id] = state.achievements[id];
          delete state.achievements[id];
        }
      }
    }
    const priorClass = findSession(saved?.activeClass?.id);
    if (priorClass?.kind === 'class' && priorClass.end > state.absoluteMinute
      && ['on-time', 'late'].includes(state.attendance[priorClass.id]) && Number.isSafeInteger(saved.activeClass.arrival)
      && Number.isInteger(saved.activeClass.segment)) {
      state.activeClass = {
        ...priorClass, status: 'active', arrival: saved.activeClass.arrival, attendance: state.attendance[priorClass.id],
        segment: clamp(saved.activeClass.segment, 0, CLASS_SEGMENTS - 1), segments: CLASS_SEGMENTS,
      };
    }
    const priorExam = findSession(saved?.activeExam?.id);
    if (!state.activeClass && priorExam?.kind === 'exam' && priorExam.start <= state.absoluteMinute
      && !state.exams[priorExam.courseId] && Number.isFinite(saved.activeExam.masteryBefore)) {
      state.activeExam = examFor(priorExam, clamp(saved.activeExam.masteryBefore));
      if (Array.isArray(saved.examDraft)) {
        state.examDraft = state.activeExam.questions.map((question, index) => {
          const value = saved.examDraft[index];
          return Number.isInteger(value) && value >= 0 && value < question.options.length ? value : null;
        });
      }
    }
    settleClasses();
    if (state.enrollment.every(id => state.exams[id])) {
      state.semesterReport = plainObject(saved?.semesterReport) && Array.isArray(saved.semesterReport.courses)
        ? saved.semesterReport : compileReport();
    }
    if (migrating) save();

    return {
      state,
      get dayIndex() { return dayOf(state.absoluteMinute); },
      get week() { return weekOf(state.absoluteMinute); },
      summary: () => ({ ...compileReport(), life: { ...state.life }, nextSession: nextSession(), semesterReport: state.semesterReport }),
      sync, save, fastForward, schedule, currentSession, nextSession, nextUpcomingSession, grade, homework, setEnrollment, updateProfile,
      startClass, takeClassSegment: (mode, courseId) => progressClass(mode, courseId, false),
      finishClass: (mode, courseId) => progressClass(mode, courseId, true),
      startExam, submitExam, doHomework, study, spendTime, eat, buySupplies, sleep,
    };
  }

  window.PixelStudentGame = Object.freeze({
    create, courses, foods, supplies, calendar, storageKey: STORAGE_KEY, dayMinutes: DAY,
    hasSave: (storage) => Boolean(load(storage === undefined ? storageFor({}) : storage)),
  });
})();

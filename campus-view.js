(() => {
  'use strict';

  const source = window.PixelCampus;

  // The two carriageways run in opposing directions in OSM. Face all their
  // segments south before summing so longer mapped segments carry more weight.
  function avenueAngle(roads) {
    let east = 0;
    let south = 0;
    for (const road of roads) {
      if (road.name !== '光华大道') continue;
      for (let i = 1; i < road.points.length; i++) {
        const [x0, y0] = road.points[i - 1];
        const [x1, y1] = road.points[i];
        const dy = y1 - y0;
        east += (x1 - x0) * (dy < 0 ? -1 : 1);
        south += Math.abs(dy);
      }
    }
    return Math.atan2(east, south);
  }

  const northAngle = avenueAngle(source.roads);
  const sin = Math.sin(northAngle);
  const cos = Math.cos(northAngle);
  const rotate = ([x, y]) => [x * cos - y * sin, x * sin + y * cos];
  const outline = source.boundary.map(rotate);
  const xs = outline.map(([x]) => x);
  const ys = outline.map(([, y]) => y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);

  const unitsPerMeter = source.geo.unitsPerMeter;
  const margin = 96 * unitsPerMeter;
  const bay = source.labels.find(label => label.name === '唐岛湾');
  const bayY = bay ? rotate([bay.x, bay.y])[1] : bottom;
  const viewLeft = Math.floor(left - margin);
  const viewTop = Math.floor(top - margin);
  const viewRight = Math.ceil(right + margin);
  const viewBottom = Math.ceil(Math.max(bottom + 2 * margin, bayY + margin / 2));

  function project(point) {
    const [x, y] = rotate(point);
    return [x - viewLeft, y - viewTop];
  }

  function projectPosition(position) {
    const [x, y] = project([position.x, position.y]);
    return { ...position, x, y };
  }

  function projectFeature(feature) {
    return { ...feature, points: feature.points.map(project) };
  }

  window.PixelCampusView = {
    ...source,
    width: viewRight - viewLeft,
    height: viewBottom - viewTop,
    spawn: projectPosition(source.spawn),
    boundary: source.boundary.map(project),
    buildings: source.buildings.map(projectFeature),
    roads: source.roads.map(projectFeature),
    areas: source.areas.map(projectFeature),
    labels: source.labels.map(projectPosition),
    campusBounds: {
      left: left - viewLeft,
      top: top - viewTop,
      right: right - viewLeft,
      bottom: bottom - viewTop,
    },
    northAngle,
  };
})();

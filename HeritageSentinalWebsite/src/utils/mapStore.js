let currentMapData = {
  NAV_NODES: [],
  LOCATIONS: [],
  ZONE_RECTS_EXPORT: [],
  GRID_STEP: 1
};

export function setMapData(data) {
  currentMapData = data;
}

export function getMapData() {
  return currentMapData;
}
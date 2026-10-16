export type Locale = "mn" | "en";

export type Copy = {
  appTitle: string;
  urbanNetwork: string;
  osmNetwork: string;
  cityName: string;
  simulation: string;
  morningPeak: string;
  morningDetail: string;
  importedDetail: string;
  start: string;
  end: string;
  vehicles: string;
  seed: string;
  importCounts: string;
  countFile: string;
  startRun: string;
  compare: string;
  cancel: string;
  compareHelp: string;
  checkingWorker: string;
  unconfiguredWorker: string;
  unreachableWorker: string;
  severeRoads: string;
  severeChart: string;
  noSevere: string;
  severeLine: (seconds: number, kmh: number) => string;
  bottleneckCount: (count: number) => string;
  scenario: string;
  selectOrDraw: string;
  baseMapLocked: string;
  clickStart: string;
  clickEnd: string;
  cancelDrawing: string;
  drawLink: string;
  toolRoads: string;
  toolTransit: string;
  toolJunctions: string;
  toolEditing: string;
  toolSelect: string;
  toolTwoWay: string;
  toolOneWay: string;
  toolStreet: string;
  toolRailway: string;
  toolBridge: string;
  toolIntersection: string;
  toolSignal: string;
  toolEraser: string;
  drawnStops: string;
  drawnDirection: string;
  twoWay: string;
  oneWay: string;
  capacityNote: string;
  frequencyNote: string;
  morningCommute: string;
  commuteHelp: string;
  zaisan: string;
  closeRoad: string;
  parkLane: string;
  stallLane: string;
  roadWork: string;
  laneCount: string;
  setLanes: string;
  speedLimit: string;
  setSpeed: string;
  setAccess: string;
  chooseLink: string;
  road: string;
  highway: string;
  subway: string;
  cars: string;
  buses: string;
  trucks: string;
  trains: string;
  nameOptional: string;
  addLink: string;
  nextRunChanges: string;
  clear: string;
  remove: string;
  play: string;
  pause: string;
  baseline: string;
  scenarioSide: string;
  simulationTime: string;
  estimatedDemand: string;
  roadHeading: string;
  nothingSelected: string;
  lanes: string;
  direction: string;
  structure: string;
  surface: string;
  length: string;
  inspectorNote: string;
  clickRoad: string;
  wayGone: string;
  scenarioOverride: (published: string, override: string) => string;
  basemap: string;
  mapStyle: string;
  dark: string;
  light: string;
  satellite: string;
  satelliteMissing: string;
  roadNetwork: string;
  arterials: string;
  arterialsDetail: string;
  localStreets: string;
  localDetail: string;
  serviceRoads: string;
  serviceDetail: string;
  waysLoaded: (count: string) => string;
  congestion: string;
  free: string;
  moderate: string;
  heavy: string;
  severe: string;
  congestionNote: string;
  roadClass: string;
  classNote: string;
  searchLabel: string;
  searchPlaceholder: string;
  searching: string;
  searchUnavailable: string;
  noPlaces: string;
  cityMap: string;
  loadingMap: string;
  loadingRoads: string;
  retry: string;
  retryBasemap: string;
  loaded: (count: string) => string;
  resizePanel: string;
  language: string;
  dashboard: string;
  saveResult: string;
  savePrompt: string;
  skipSave: string;
  resultName: string;
  saved: string;
  saveBaseline: string;
  saveScenario: string;
  noSaved: string;
  referenceResult: string;
  changedResult: string;
  deleteResult: string;
  shareOfRun: (percent: number) => string;
  effectOfChange: (percent: number) => string;
  newBottleneck: string;
  becauseOf: (name: string, edits: string) => string;
  clocksDiffer: string;
  couldNotSave: string;
  couldNotLoadSaved: string;
  severeTotal: (seconds: number) => string;
  openChart: string;
  chartHeading: string;
  compareWith: string;
  commuteOn: string;
  commuteOff: string;
  editCount: (count: number) => string;
  closeChart: string;
  severeSeconds: string;
  normalNetwork: string;
  templates: string;
  saveTemplate: string;
  inBothTemplates: string;
};

const en: Copy = {
  appTitle: "Ulaanbaatar Traffic",
  urbanNetwork: "Urban network",
  osmNetwork: "OpenStreetMap road network",
  cityName: "Ulaanbaatar, Mongolia",
  simulation: "Simulation",
  morningPeak: "Morning peak, estimated",
  morningDetail:
    "Synthetic demand, not calibrated counts. Passenger cars only. Most trips head toward offices and universities.",
  importedDetail: "Vehicle count imported from a file. Trips are still estimated, not calibrated routes.",
  start: "Start",
  end: "End",
  vehicles: "Vehicles",
  seed: "Seed",
  importCounts: "Import counts",
  countFile: "Vehicle count file",
  startRun: "Start",
  compare: "Compare",
  cancel: "Cancel",
  compareHelp: "Compare runs this clock, vehicle count, and seed on the unchanged network, then on the scenario.",
  checkingWorker: "Checking the simulation worker…",
  unconfiguredWorker: "Set VITE_SIMULATION_URL to connect the SUMO worker.",
  unreachableWorker: "Simulation worker is not running.",
  severeRoads: "Severe roads",
  severeChart: "Severe roads over the window",
  noSevere: "No road stayed severe in this run.",
  severeLine: (seconds, kmh) => `${seconds}s · ${kmh} km/h`,
  bottleneckCount: (count) => `${count} bottleneck ${count === 1 ? "road" : "roads"}`,
  scenario: "Scenario",
  selectOrDraw: "Select a road, or draw a new link.",
  baseMapLocked: "The base map is locked. Open a template to change roads.",
  clickStart: "Click the start on a road.",
  clickEnd: "Click the end on a road.",
  cancelDrawing: "Cancel drawing",
  drawLink: "Draw a link",
  toolRoads: "Roads",
  toolTransit: "Public transport",
  toolJunctions: "Intersections",
  toolEditing: "Editing",
  toolSelect: "Select",
  toolTwoWay: "Two-way road",
  toolOneWay: "One-way road",
  toolStreet: "Street",
  toolRailway: "Railway",
  toolBridge: "Bridge",
  toolIntersection: "Intersection",
  toolSignal: "Traffic light",
  toolEraser: "Eraser",
  drawnStops: "Stops",
  drawnDirection: "Direction",
  twoWay: "Two-way",
  oneWay: "One-way",
  capacityNote: "Capacity is a scenario note. It is not a measured traffic value.",
  frequencyNote: "Train frequency is a scenario note. It is not a measured traffic value.",
  morningCommute: "Morning commute",
  commuteHelp:
    "Most trips end at offices and universities from OpenStreetMap. Demand is still estimated, not counted traffic.",
  zaisan: "Zaisan checkpoint: slow signal before 09:00 and after 18:00.",
  closeRoad: "Close this road for the next run",
  parkLane: "Parked cars in the curb lane",
  stallLane: "Stalled car in one lane",
  roadWork: "Road work",
  laneCount: "Lane count",
  setLanes: "Set the lane count",
  speedLimit: "Speed limit",
  setSpeed: "Set the speed limit",
  setAccess: "Set who may use this road",
  chooseLink: "Choose the link type and who may use it.",
  road: "Road",
  highway: "Highway",
  subway: "Subway",
  cars: "Cars",
  buses: "Buses",
  trucks: "Trucks",
  trains: "Subway trains",
  nameOptional: "Name, optional",
  addLink: "Add this link",
  nextRunChanges: "Changes for the next run",
  clear: "Clear",
  remove: "Remove",
  play: "Play",
  pause: "Pause",
  baseline: "Baseline",
  scenarioSide: "Scenario",
  simulationTime: "Simulation time",
  estimatedDemand: "Estimated demand",
  roadHeading: "Road",
  nothingSelected: "Nothing selected",
  lanes: "Lanes",
  direction: "Direction",
  structure: "Structure",
  surface: "Surface",
  length: "Length",
  inspectorNote:
    "Attributes come from OpenStreetMap tags. Missing tags stay unknown. This is not a simulation result. Scenario changes are listed under Simulation.",
  clickRoad: "Click a road on the map to read its OpenStreetMap attributes.",
  wayGone: "That way is no longer in the loaded network.",
  scenarioOverride: (published, override) => `${published} · scenario ${override}`,
  basemap: "Basemap",
  mapStyle: "Map style",
  dark: "Dark",
  light: "Light",
  satellite: "Satellite",
  satelliteMissing: "Satellite imagery is not configured. Set VITE_SATELLITE_TILE_URL.",
  roadNetwork: "Road network",
  arterials: "Arterials",
  arterialsDetail: "Motorway through tertiary, including links",
  localStreets: "Local streets",
  localDetail: "Unclassified, residential, and living streets from zoom 13",
  serviceRoads: "Service roads",
  serviceDetail: "Loaded from zoom 16 when this layer is on",
  waysLoaded: (count) => `${count} ways loaded`,
  congestion: "Congestion",
  free: "Free",
  moderate: "Moderate",
  heavy: "Heavy",
  severe: "Severe",
  congestionNote:
    "Color is the simulated speed compared with the SUMO speed limit. Roads with no vehicles in this second keep their class color. Demand is estimated, not calibrated counts.",
  roadClass: "Road class",
  classNote:
    "Color shows the OpenStreetMap road class. Ulaanbaatar roads are read from a local extract, so panning does not call Overpass. Congestion colors stay unused until a simulation publishes segment speeds.",
  searchLabel: "Search for a city or place",
  searchPlaceholder: "Search a city or place",
  searching: "Searching…",
  searchUnavailable: "Place search is unavailable right now.",
  noPlaces: "No matching places.",
  cityMap: "City map",
  loadingMap: "Loading map…",
  loadingRoads: "Loading roads…",
  retry: "Retry",
  retryBasemap: "Retry basemap",
  loaded: (count) => `${count} loaded`,
  resizePanel: "Resize the side panel",
  language: "Language",
  dashboard: "Dashboard",
  saveResult: "Save result",
  savePrompt: "Save this result?",
  skipSave: "Skip",
  resultName: "Name",
  saved: "Saved",
  saveBaseline: "Save baseline",
  saveScenario: "Save scenario",
  noSaved: "No saved results yet.",
  referenceResult: "Reference",
  changedResult: "Change",
  deleteResult: "Delete",
  shareOfRun: (percent) => `${percent}% of severe time`,
  effectOfChange: (percent) => `${percent > 0 ? "+" : ""}${percent}%`,
  newBottleneck: "New bottleneck",
  becauseOf: (name, edits) => (edits ? `Because of ${name}: ${edits}` : `Because of ${name}`),
  clocksDiffer: "These results use different clocks, so the seconds are not lined up.",
  couldNotSave: "The result could not be saved.",
  couldNotLoadSaved: "The saved results could not be read.",
  severeTotal: (seconds) => `${seconds} severe-road seconds`,
  openChart: "Chart",
  chartHeading: "How this run changed",
  compareWith: "Compare with other results",
  commuteOn: "Morning commute on",
  commuteOff: "Morning commute off",
  editCount: (count) => `${count} ${count === 1 ? "edit" : "edits"}`,
  closeChart: "Close",
  severeSeconds: "Severe seconds",
  normalNetwork: "Normal network",
  templates: "Templates",
  saveTemplate: "Save template",
  inBothTemplates: "In both",
};

const mn: Copy = {
  appTitle: "Улаанбаатарын хөдөлгөөн",
  urbanNetwork: "Хот төлөвлөлт",
  osmNetwork: "OpenStreetMap замын сүлжээ",
  cityName: "Улаанбаатар, Монгол",
  simulation: "Загварчлал",
  morningPeak: "Өглөөний оргил, тооцоолсон",
  morningDetail:
    "Энэ нь тооцоолсон ачаалал бөгөөд бодит тооллого биш. Зөвхөн суудлын автомашин. Ихэнх аялал албан газар, их сургууль руу чиглэнэ.",
  importedDetail: "Тээврийн хэрэгслийн тоог файлаас оруулсан. Аялал тооцоолсон хэвээр, тохируулсан маршрут биш.",
  start: "Эхлэх",
  end: "Дуусах",
  vehicles: "Тээврийн хэрэгсэл",
  seed: "Санамж",
  importCounts: "Тоо оруулах",
  countFile: "Тээврийн хэрэгслийн тооны файл",
  startRun: "Эхлүүлэх",
  compare: "Харьцуулах",
  cancel: "Болих",
  compareHelp: "Харьцуулалт энэ цаг, тоо, санамжаар эхлээд өөрчлөгдөөгүй сүлжээ, дараа нь нөхцөлийг ажиллуулна.",
  checkingWorker: "Загварчлалын ажиллагчийг шалгаж байна…",
  unconfiguredWorker: "SUMO ажиллагчийг холбохын тулд VITE_SIMULATION_URL тохируулна уу.",
  unreachableWorker: "Загварчлалын ажиллагч ажиллахгүй байна.",
  severeRoads: "Хүнд түгжрэлтэй зам",
  severeChart: "Цонхны хугацаан дахь хүнд түгжрэлтэй зам",
  noSevere: "Энэ ажиллуулалтад хүнд түгжрэлтэй үлдсэн зам алга.",
  severeLine: (seconds, kmh) => `${seconds} с · ${kmh} км/ц`,
  bottleneckCount: (count) => `${count} түгжрэлийн цэг`,
  scenario: "Нөхцөл",
  selectOrDraw: "Зам сонгох, эсвэл шинэ холбоос зурна уу.",
  baseMapLocked: "Суурь зураг түгжээтэй. Зам өөрчлөхийн тулд загвар нээнэ үү.",
  clickStart: "Зам дээр эхлэх цэгээ дарна уу.",
  clickEnd: "Зам дээр төгсгөлийн цэгээ дарна уу.",
  cancelDrawing: "Зурахаа болих",
  drawLink: "Холбоос зурах",
  toolRoads: "Зам",
  toolTransit: "Нийтийн тээвэр",
  toolJunctions: "Уулзвар",
  toolEditing: "Засвар",
  toolSelect: "Сонгох",
  toolTwoWay: "Хоёр чигийн зам",
  toolOneWay: "Нэг чигийн зам",
  toolStreet: "Гудамж",
  toolRailway: "Төмөр зам",
  toolBridge: "Гүүр",
  toolIntersection: "Уулзвар",
  toolSignal: "Гэрлэн дохио",
  toolEraser: "Баллуур",
  drawnStops: "Зогсоол",
  drawnDirection: "Чиглэл",
  twoWay: "Хоёр чиг",
  oneWay: "Нэг чиг",
  capacityNote: "Багтаамж нь нөхцөлийн тэмдэглэл. Хэмжсэн хөдөлгөөний утга биш.",
  frequencyNote: "Галт тэрэгний давтамж нь нөхцөлийн тэмдэглэл. Хэмжсэн хөдөлгөөний утга биш.",
  morningCommute: "Өглөөний ажил руу",
  commuteHelp:
    "Ихэнх аялал OpenStreetMap дээрх албан газар, их сургуульд төгсөнө. Ачаалал тооцоолсон бөгөөд бодит тооллого биш.",
  zaisan: "Зайсаны хяналтын цэг: 09:00-аас өмнө болон 18:00-аас хойш гэрлэн дохио удаан.",
  closeRoad: "Дараагийн ажиллуулалтад энэ замыг хаах",
  parkLane: "Хашлаганы эгнээнд зогссон машин",
  stallLane: "Нэг эгнээнд гацсан машин",
  roadWork: "Зам засвар",
  laneCount: "Эгнээний тоо",
  setLanes: "Эгнээ тохируулах",
  speedLimit: "Хурдны хязгаар",
  setSpeed: "Хурд тохируулах",
  setAccess: "Хэн явахыг тохируулах",
  chooseLink: "Холбоосын төрөл болон хэн явахыг сонгоно уу.",
  road: "Зам",
  highway: "Хурдны зам",
  subway: "Метро",
  cars: "Автомашин",
  buses: "Автобус",
  trucks: "Ачааны машин",
  trains: "Метроны галт тэрэг",
  nameOptional: "Нэр, заавал биш",
  addLink: "Энэ холбоосыг нэмэх",
  nextRunChanges: "Дараагийн ажиллуулалтын өөрчлөлт",
  clear: "Арилгах",
  remove: "Хасах",
  play: "Тоглуулах",
  pause: "Түр зогсоох",
  baseline: "Суурь",
  scenarioSide: "Нөхцөл",
  simulationTime: "Загварчлалын цаг",
  estimatedDemand: "Тооцоолсон ачаалал",
  roadHeading: "Зам",
  nothingSelected: "Юу ч сонгоогүй",
  lanes: "Эгнээ",
  direction: "Чиглэл",
  structure: "Бүтэц",
  surface: "Хучилт",
  length: "Урт",
  inspectorNote:
    "Мэдээлэл OpenStreetMap шошгоос ирнэ. Дутуу шошго тодорхойгүй хэвээр. Энэ нь загварчлалын үр дүн биш. Нөхцөлийн өөрчлөлт Загварчлал хэсэгт байна.",
  clickRoad: "Газрын зураг дээрх замыг дарж OpenStreetMap мэдээллийг уншина уу.",
  wayGone: "Тэр зам ачаалсан сүлжээнд байхгүй болсон.",
  scenarioOverride: (published, override) => `${published} · нөхцөл ${override}`,
  basemap: "Суурь зураг",
  mapStyle: "Зургийн өнгө",
  dark: "Бараан",
  light: "Гэгээтэй",
  satellite: "Хиймэл дагуул",
  satelliteMissing: "Хиймэл дагуулын зураг тохируулаагүй. VITE_SATELLITE_TILE_URL тохируулна уу.",
  roadNetwork: "Замын сүлжээ",
  arterials: "Гол зам",
  arterialsDetail: "Хурдны замаас гуравдугаар зэрэглэл хүртэл, холбоосыг оролцуулна",
  localStreets: "Орон нутгийн гудамж",
  localDetail: "Ангилаагүй, орон сууцны болон амьдрах гудамж, 13-аас томруулсан үед",
  serviceRoads: "Үйлчилгээний зам",
  serviceDetail: "Энэ давхарга ассан үед 16-аас томруулбал ачаална",
  waysLoaded: (count) => `${count} зам ачаалсан`,
  congestion: "Түгжрэл",
  free: "Чөлөөтэй",
  moderate: "Дунд",
  heavy: "Хүнд",
  severe: "Маш хүнд",
  congestionNote:
    "Өнгө нь SUMO хурдны хязгаартай харьцуулсан загварчилсан хурд. Энэ секундэд машингүй зам ангийнхаа өнгөөр үлдэнэ. Ачаалал тооцоолсон бөгөөд бодит тооллого биш.",
  roadClass: "Замын ангилал",
  classNote:
    "Өнгө нь OpenStreetMap замын ангиллыг харуулна. Улаанбаатарын замыг дотоод файлаас уншина, тиймээс шилжүүлэхэд Overpass дуудагдахгүй. Замын хэсгийн хурд гартал түгжрэлийн өнгө ашиглагдахгүй.",
  searchLabel: "Хот, газар хайх",
  searchPlaceholder: "Хот, газар хайх",
  searching: "Хайж байна…",
  searchUnavailable: "Газар хайлт одоо боломжгүй.",
  noPlaces: "Тохирох газар алга.",
  cityMap: "Хот газрын зураг",
  loadingMap: "Газрын зураг ачаалж байна…",
  loadingRoads: "Зам ачаалж байна…",
  retry: "Дахин",
  retryBasemap: "Суурь зургийг дахин",
  loaded: (count) => `${count} ачаалсан`,
  resizePanel: "Хажуугийн самбарын хэмжээг өөрчлөх",
  language: "Хэл",
  dashboard: "Хяналтын самбар",
  saveResult: "Үр дүн хадгалах",
  savePrompt: "Энэ үр дүнг хадгалах уу?",
  skipSave: "Алгасах",
  resultName: "Нэр",
  saved: "Хадгалсан",
  saveBaseline: "Суурийг хадгалах",
  saveScenario: "Нөхцөлийг хадгалах",
  noSaved: "Хадгалсан үр дүн алга.",
  referenceResult: "Суурь",
  changedResult: "Өөрчлөлт",
  deleteResult: "Устгах",
  shareOfRun: (percent) => `Хүнд цагийн ${percent}%`,
  effectOfChange: (percent) => `${percent > 0 ? "+" : ""}${percent}%`,
  newBottleneck: "Шинэ түгжрэл",
  becauseOf: (name, edits) => (edits ? `${name} өөрчлөлтөөс: ${edits}` : `${name} өөрчлөлтөөс`),
  clocksDiffer: "Цагийн цонх өөр тул секундийг зэрэгцүүлэхгүй.",
  couldNotSave: "Үр дүнг хадгалж чадсангүй.",
  couldNotLoadSaved: "Хадгалсан үр дүнг уншиж чадсангүй.",
  severeTotal: (seconds) => `${seconds} хүнд түгжрэлийн секунд`,
  openChart: "График",
  chartHeading: "Энэ ажиллалт хэрхэн өөрчлөгдсөн",
  compareWith: "Бусад үр дүнтэй харьцуулах",
  commuteOn: "Өглөөний ажил руу асаалттай",
  commuteOff: "Өглөөний ажил руу унтраалттай",
  editCount: (count) => `${count} засвар`,
  closeChart: "Хаах",
  severeSeconds: "Хүнд түгжрэлийн секунд",
  normalNetwork: "Энгийн сүлжээ",
  templates: "Загвар",
  saveTemplate: "Загвар хадгалах",
  inBothTemplates: "Хоёуланд",
};

export const CATALOG: Record<Locale, Copy> = { mn, en };

const CLASS_MN: Record<string, string> = {
  Motorway: "Хурдны зам",
  Trunk: "Гол магистраль",
  Primary: "Нэгдүгээр",
  Secondary: "Хоёрдугаар",
  Tertiary: "Гуравдугаар",
  Local: "Орон нутгийн",
  "Living street": "Амьдрах гудамж",
  Service: "Үйлчилгээний",
};

export function classLabel(locale: Locale, label: string): string {
  if (locale === "en") return label;
  return CLASS_MN[label] ?? label;
}

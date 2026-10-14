import type { Locale } from "@/i18n/catalog";

const EXACT: Record<string, string> = {
  "Ulaanbaatar, Mongolia": "Улаанбаатар, Монгол",
  "Use a clock range such as 07:30–07:45.": "07:30–07:45 гэх мэт цагийн муж оруулна уу.",
  "The window must be at least 1 minute.": "Цонх хамгийн багадаа 1 минут байна.",
  "The window must be at most 15 minutes.": "Цонх хамгийн ихдээ 15 минут байна.",
  "Seed must be a whole number from 0 to 2147483647.": "Санамж 0-оос 2147483647 хүртэлх бүхэл тоо байна.",
  "Draw a link from its two ends.": "Холбоосыг хоёр үзүүрээс нь зурна уу.",
  "Choose a road on the map.": "Газрын зураг дээрх замыг сонгоно уу.",
  "Lanes must be a whole number from 1 to 4.": "Эгнээ 1-ээс 4 хүртэлх бүхэл тоо байна.",
  "Speed must be a whole number from 10 to 90 km/h.": "Хурд 10-аас 90 км/ц хүртэлх бүхэл тоо байна.",
  "Choose at least one kind of vehicle.": "Дор хаяж нэг төрлийн тээврийн хэрэгсэл сонгоно уу.",
  "A scenario can change at most 400 roads.": "Нэг нөхцөл хамгийн ихдээ 400 замыг өөрчилнө.",
  "Choose two different ends.": "Хоёр өөр үзүүр сонгоно уу.",
  "Click a road on the map. The link has to meet an existing road.":
    "Газрын зураг дээрх замыг дарна уу. Холбоос байгаа замтай нийлнэ.",
  "Subway trains need a drawn subway link.": "Метроны галт тэрэгэнд зурсан метро холбоос хэрэгтэй.",
  "Zaisan checkpoint: slow signal before 09:00 and after 18:00.":
    "Зайсаны хяналтын цэг: 09:00-аас өмнө болон 18:00-аас хойш гэрлэн дохио удаан.",
  "This window is during work hours, so Zaisan Street keeps its normal signal.":
    "Энэ цонх ажлын цагт багтах тул Зайсаны гудамжны дохио ердийн хэвээр.",
  "The slow signal changes when this window crosses 09:00 or 18:00.":
    "Энэ цонх 09:00 эсвэл 18:00-г давах үед удаан дохио солигдоно.",
  "The two runs share no timestamps to compare.": "Хоёр ажиллуулалтад харьцуулах ижил цаг алга.",
  "Severe-road seconds match the baseline.": "Хүнд түгжрэлийн секунд суурьтай тэнцүү.",
  "No active simulation": "Идэвхтэй загварчлал алга",
  "Simulation running": "Загварчлал ажиллаж байна",
  "Simulation failed": "Загварчлал амжилтгүй",
  "Simulation failed.": "Загварчлал амжилтгүй.",
  "Simulation cancelled": "Загварчлалыг болиулсан",
  "Starting simulation": "Загварчлал эхэлж байна",
  "Could not cancel the simulation.": "Загварчлалыг болиулж чадсангүй.",
  "Simulation worker is not running.": "Загварчлалын ажиллагч ажиллахгүй байна.",
  "Zoom in to load roads for this view.": "Энэ харагдацын замыг ачаалахын тулд томруулна уу.",
  "Could not load roads from OpenStreetMap. Try again in a moment.":
    "OpenStreetMap-оос замыг ачаалж чадсангүй. Түр хүлээгээд дахин оролдоно уу.",
  "Could not load the basemap.": "Суурь зургийг ачаалж чадсангүй.",
  "The count file could not be read.": "Тооны файлыг уншиж чадсангүй.",
  "The saved results could not be read.": "Хадгалсан үр дүнг уншиж чадсангүй.",
  "The result could not be saved.": "Үр дүнг хадгалж чадсангүй.",
  "The result was not saved.": "Үр дүн хадгалагдаагүй.",
  "Simulation worker is not connected.": "Загварчлалын ажиллагч холбогдоогүй.",
  "The count file needs a whole number of vehicles from 1 to 5000.":
    "Тооны файлд 1-ээс 5000 хүртэлх бүхэл тооны тээврийн хэрэгсэл байх ёстой.",
  "Building the edited city network": "Зассан хотын сүлжээг бүтээж байна",
  "Building the city network": "Хотын сүлжээг бүтээж байна",
  "Setting the slow Zaisan Street signal": "Зайсаны гудамжны удаан дохиог тохируулж байна",
  "Office and university locations are missing. Run npm run attractors:export.":
    "Албан газар, их сургуулийн байршил алга. npm run attractors:export ажиллуулна уу.",
  "No office or university is close enough to the road network.":
    "Замын сүлжээнд хангалттай ойр албан газар, их сургууль алга.",
  "The SUMO network has no edges tied to an OpenStreetMap way.":
    "SUMO сүлжээнд OpenStreetMap замтай холбоотой хэсэг алга.",
  "SUMO could not place passenger-car trips on this city network.":
    "SUMO энэ хотын сүлжээнд суудлын аялал байрлуулж чадсангүй.",
  Unknown: "Тодорхойгүй",
  "One-way": "Нэг чигийн",
  "One-way, reverse": "Нэг чигийн, эсрэг",
  "Two-way": "Хоёр чигийн",
  Bridge: "Гүүр",
  Tunnel: "Тунель",
  "At grade": "Газрын түвшинд",
  Motorway: "Хурдны зам",
  "Motorway Link": "Хурдны замын холбоос",
  Trunk: "Гол магистраль",
  "Trunk Link": "Магистралийн холбоос",
  Primary: "Нэгдүгээр зэрэглэл",
  "Primary Link": "Нэгдүгээр холбоос",
  Secondary: "Хоёрдугаар зэрэглэл",
  "Secondary Link": "Хоёрдугаар холбоос",
  Tertiary: "Гуравдугаар зэрэглэл",
  "Tertiary Link": "Гуравдугаар холбоос",
  Unclassified: "Ангилаагүй",
  Residential: "Орон сууцны",
  "Living Street": "Амьдрах гудамж",
  Service: "Үйлчилгээний",
  Asphalt: "Асфальт",
  Paved: "Хатуу хучилттай",
  Unpaved: "Хучилтгүй",
  Gravel: "Хайрга",
  Concrete: "Бетон",
  "New road": "Шинэ зам",
  "New highway": "Шинэ хурдны зам",
  "New subway": "Шинэ метро",
};

const MODES: [string, string][] = [
  ["subway trains", "метроны галт тэрэг"],
  ["cars", "автомашин"],
  ["buses", "автобус"],
  ["trucks", "ачааны машин"],
];

export function localize(locale: Locale, value: string | null | undefined): string {
  if (!value) return "";
  if (locale === "en") return value;
  return translate(value);
}

function translate(value: string): string {
  const baseline = value.match(/^(Baseline|Scenario): (.*)$/);
  if (baseline) {
    const label = baseline[1] === "Baseline" ? "Суурь" : "Нөхцөл";
    return `${label}: ${translate(baseline[2] ?? "")}`;
  }
  if (EXACT[value]) return EXACT[value];
  return pattern(value) ?? value;
}

function pattern(value: string): string | null {
  let match = /^Vehicles must be a whole number from 1 to (\d+)\.$/.exec(value);
  if (match) return `Тээврийн хэрэгсэл 1-ээс ${match[1]} хүртэлх бүхэл тоо байна.`;

  match = /^Could not read simulation results \((\d+)\)\.$/.exec(value);
  if (match) return `Загварчлалын үр дүнг уншиж чадсангүй (${match[1]}).`;

  match = /^Could not cancel the simulation \((\d+)\)\.$/.exec(value);
  if (match) return `Загварчлалыг болиулж чадсангүй (${match[1]}).`;

  match = /^Close (.+) for the next run\.$/.exec(value);
  if (match) return `${match[1]} замыг дараагийн ажиллуулалтад хаана.`;

  match = /^Set (.+) to (\d+) lanes?\.$/.exec(value);
  if (match) return `${match[1]} замын эгнээг ${match[2]} болгоно.`;

  match = /^Set the speed limit on (.+) to (\d+) km\/h\.$/.exec(value);
  if (match) return `${match[1]} замын хурдны хязгаарыг ${match[2]} км/ц болгоно.`;

  match = /^Let (.+) use (.+)\.$/.exec(value);
  if (match) return `${match[2]} замаар ${modes(match[1] ?? "")} явна.`;

  match = /^Parked cars block the curb lane of (.+), two minutes at a time\.$/.exec(value);
  if (match) return `${match[1]} замын хашлаганы эгнээг зогссон машин 2 минут тутам хаана.`;

  match = /^A stalled car blocks one lane of (.+) for the middle of the run\.$/.exec(value);
  if (match) return `${match[1]} замын нэг эгнээг гацсан машин ажиллуулалтын дундуур хаана.`;

  match = /^Road work on (.+): one fewer lane, 30 km\/h\.$/.exec(value);
  if (match) return `${match[1]} зам дээр засвар: нэг эгнээ бага, 30 км/ц.`;

  match = /^(.+), for (.+)\.$/.exec(value);
  if (match) return `${kindName(match[1] ?? "")}, ${modes(match[2] ?? "")}.`;

  match =
    /^The scenario has (\d+) (more|fewer) severe-road seconds? than the baseline\. The largest gap is ([0-9:]+), with (\d+) (more|fewer) severe roads?\.$/.exec(
      value,
    );
  if (match) {
    const lead = match[2] === "more" ? "илүү" : "бага";
    const gap = match[5] === "more" ? "илүү" : "бага";
    return `Нөхцөл сууриас ${match[1]} хүнд түгжрэлийн секундээр ${lead}. Хамгийн их зөрүү ${match[3]}-д, ${match[4]} хүнд түгжрэлтэй замаар ${gap}.`;
  }

  match = /^The scenario has (\d+) (more|fewer) severe-road seconds? than the baseline\.$/.exec(value);
  if (match) {
    const lead = match[2] === "more" ? "илүү" : "бага";
    return `Нөхцөл сууриас ${match[1]} хүнд түгжрэлийн секундээр ${lead}.`;
  }

  match = /^Generating estimated demand toward offices and universities \((.+), seed (\d+)\)$/.exec(value);
  if (match) {
    return `Албан газар, их сургууль руу чиглэсэн тооцоолсон ачааллыг үүсгэж байна (${modes(match[1] ?? "")}, санамж ${match[2]})`;
  }

  match = /^Generating estimated demand \((.+), seed (\d+)\)$/.exec(value);
  if (match) return `Тооцоолсон ачааллыг үүсгэж байна (${modes(match[1] ?? "")}, санамж ${match[2]})`;

  match = /^Simulating (\d+) estimated trips$/.exec(value);
  if (match) return `${match[1]} тооцоолсон аяллыг загварчилж байна`;

  match = /^Simulating ([0-9:]+)$/.exec(value);
  if (match) return `${match[1]}-г загварчилж байна`;

  match = /^(\d+) km\/h$/.exec(value);
  if (match) return `${match[1]} км/ц`;

  match = /^(\d+) m$/.exec(value);
  if (match) return `${match[1]} м`;

  match = /^([\d.]+) km$/.exec(value);
  if (match) return `${match[1]} км`;

  return null;
}

function modes(value: string): string {
  let text = value;
  for (const [english, mongolian] of MODES) text = text.replaceAll(english, mongolian);
  return text.replaceAll(", and ", ", ").replaceAll(" and ", ", ");
}

function kindName(value: string): string {
  return EXACT[value] ?? value;
}

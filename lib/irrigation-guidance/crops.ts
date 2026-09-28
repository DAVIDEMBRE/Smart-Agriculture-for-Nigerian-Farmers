import type { CropGuidance, Source } from "./types";

/**
 * Watering knowledge base for every crop the site can name: the 22 crops the
 * recommender knows and the 5 the irrigation model knows. The two sets do not
 * overlap.
 *
 * Kc values are FAO-56 Table 12 single crop coefficients (initial / mid / end)
 * with the development value interpolated, or FAO Training Manual 3 Table 8
 * four-stage values, unless `kcBasis` says otherwise. Rooting classes follow
 * FAO Training Manual 4. Drought sensitivity and critical stages follow FAO
 * Training Manual 4 Tables 1 and 2 where the crop is listed.
 */

const FAO56_KC: Source = {
  title: "FAO Irrigation and Drainage Paper 56, Table 12 — single crop coefficients",
  url: "https://www.fao.org/4/x0490e/x0490e0b.htm",
};
const FAO56_ROOTS: Source = {
  title: "FAO Irrigation and Drainage Paper 56, Table 22 — rooting depth and depletion fraction",
  url: "https://www.fao.org/4/x0490e/x0490e0e.htm",
};
const FAO3_KC: Source = {
  title: "FAO Irrigation Water Management Training Manual 3, Chapter 3 — crop water needs and Kc by stage",
  url: "https://www.fao.org/4/s2022e/s2022e07.htm",
};
const FAO4_SENSITIVITY: Source = {
  title: "FAO Irrigation Water Management Training Manual 4, Chapter 2 — growth stages sensitive to water shortage",
  url: "https://www.fao.org/4/t7202e/t7202e05.htm",
};
const FAO4_SCHEDULE: Source = {
  title: "FAO Irrigation Water Management Training Manual 4, Chapter 3 — rooting depth classes and net irrigation depth by soil",
  url: "https://www.fao.org/4/t7202e/t7202e06.htm",
};
const IRRI_WATER: Source = {
  title: "IRRI Rice Knowledge Bank — water management",
  url: "http://www.knowledgebank.irri.org/step-by-step-production/growth/water-management",
};
const AFRICARICE: Source = {
  title: "Thirty years of water management research for rice in sub-Saharan Africa (AfricaRice)",
  url: "https://www.sciencedirect.com/science/article/pii/S0378429022001198",
};
const AGRIC_NG_TIMING: Source = {
  title: "Agriculture Nigeria — irrigation scheduling in vegetable production (time of day)",
  url: "https://www.agriculturenigeria.com/irrigation-scheduling-sustainable-vegetable-production/",
};
const CARR_MANGO: Source = {
  title: "Carr — The water relations and irrigation requirements of mango: a review (Experimental Agriculture)",
  url: "https://www.cambridge.org/core/journals/experimental-agriculture/article/abs/water-relations-and-irrigation-requirements-of-mango-mangifera-indica-l-a-review/EE26546082EE7089A5173802C23D2892",
};
const CARR_PAPAYA: Source = {
  title: "Carr — The water relations and irrigation requirements of papaya: a review (Experimental Agriculture)",
  url: "https://www.cambridge.org/core/journals/experimental-agriculture/article/abs/water-relations-and-irrigation-requirements-of-papaya-carica-papaya-l-a-review/08AFF911B3D1652354D6B8018F429F09",
};
const PLANTVILLAGE_PAPAYA: Source = {
  title: "PlantVillage — papaya waterlogging stress",
  url: "https://plantvillage.psu.edu/posts/7727-papaya-pawpaw-water-logging-stress-papaya-farm",
};
const POMEGRANATE_KC: Source = {
  title: "Crop coefficient and evapotranspiration of pomegranate (Acta Scientific Agriculture)",
  url: "https://actascientific.com/ASAG/pdf/ASAG-03-0547.pdf",
};
const POMEGRANATE_CRACKING: Source = {
  title: "Fruit cracking in pomegranate: extent, cause and management — a review",
  url: "https://www.tandfonline.com/doi/full/10.1080/15538362.2020.1784074",
};
const VIKASPEDIA_PIGEONPEA: Source = {
  title: "Vikaspedia — pigeon pea package of practices",
  url: "https://agriculture.vikaspedia.in/viewcontent/agriculture/crop-production/package-of-practices/pulses/pigeon-pea?lgn=en",
};
const BLACKGRAM: Source = {
  title: "Agriculture Institute — black gram growth conditions and management",
  url: "https://agriculture.institute/agriculture-fundamentals/black-gram-farming-optimal-conditions-management/",
};
const FEEDIPEDIA_MOTHBEAN: Source = {
  title: "Feedipedia — moth bean (Vigna aconitifolia)",
  url: "https://www.feedipedia.org/node/237",
};
const MOTHBEAN_REVIEW: Source = {
  title: "Moth bean: a minor legume with major potential (PMC)",
  url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10279967/",
};
const PROSEA_JUTE: Source = {
  title: "PROSEA — Corchorus (jute): water requirements and waterlogging tolerance",
  url: "https://prosea.prota4u.org/view.aspx?id=6531",
};
const JUTE_WATERLOGGING: Source = {
  title: "Impact of waterlogging on yield and quality of tossa jute",
  url: "https://www.researchgate.net/publication/288579454_Impact_of_waterlogging_on_yield_and_quality_of_tossa_jute_Corchorus_olitorius",
};
const CPCRI_COCONUT: Source = {
  title: "ICAR-CPCRI — coconut irrigation research achievements (basin and drip norms)",
  url: "https://cpcri.gov.in/page/research_achievements_crop_production/",
};
const TNAU_COCONUT: Source = {
  title: "TNAU Agritech — coconut irrigation management",
  url: "http://www.agritech.tnau.ac.in/expert_system/coconut/coconut/coconut_irrigation_management.html",
};

/** FAO-56 Table 12 values with the development stage interpolated. */
const kc = (initial: number, mid: number, late: number) => ({
  initial,
  development: Number(((initial + mid) / 2).toFixed(2)),
  mid,
  late,
});

export const cropGuidance: CropGuidance[] = [
  // ------------------------------------------------------------------ cereals
  {
    id: "rice",
    name: { en: "Rice", pcm: "Rice" },
    category: "cereal",
    irrigationModelCrop: false,
    waterNeed: "flooded",
    rooting: "shallow",
    kc: kc(1.05, 1.2, 0.75),
    kcBasis: "FAO-56 Table 12, rice (Kc end 0.90-0.60 taken as 0.75).",
    droughtSensitivity: "high",
    criticalStages: ["flowering", "yield_formation"],
    waterloggingRisk: "low",
    timeOfDay: "morning_or_evening",
    notes: {
      en: {
        critical:
          "Lowland rice is extremely sensitive to drying out from panicle initiation through flowering: drought then causes sterile spikelets and lost yield. Keep about 5 cm of standing water from heading to the end of flowering.",
        afterRain:
          "Rain simply tops up the flood. Check the bund level; if water stands above 10 cm, open the outlet so the crop is not submerged.",
        watchFor: "Cracked soil surface or a field with no standing water during tillering to flowering means water is overdue. Leaf rolling at midday is a late warning.",
        practice:
          "After transplanting keep about 3 cm of water, rising to 5-10 cm as plants grow. Drain the field 7-10 days before harvest so the grain hardens and the ground carries the harvest.",
      },
      pcm: {
        critical:
          "Lowland rice no fit bear dry ground at all from when panicle dey form until flowering finish: if water no dey, the seed go empty and harvest go small. Keep about 5 cm water for ground from heading till flowering finish.",
        afterRain: "Rain just add to the water wey dey there. Check the bund; if water pass 10 cm, open the outlet make rice no drown.",
        watchFor: "If ground crack or no water dey field from tillering to flowering, water don late. Leaf wey roll for afternoon na late warning.",
        practice:
          "After you transplant keep about 3 cm water, then raise am to 5-10 cm as plant dey grow. Drain the field 7-10 days before harvest so the grain go hard and ground go fit carry the harvest.",
      },
    },
    sources: [FAO56_KC, FAO4_SENSITIVITY, IRRI_WATER, AFRICARICE],
  },
  {
    id: "maize",
    name: { en: "Maize", pcm: "Maize (corn)" },
    category: "cereal",
    irrigationModelCrop: false,
    waterNeed: "moderate",
    rooting: "deep",
    kc: { initial: 0.4, development: 0.8, mid: 1.15, late: 0.7 },
    kcBasis: "FAO Training Manual 3 Table 8, maize grain.",
    droughtSensitivity: "medium",
    criticalStages: ["flowering", "yield_formation"],
    waterloggingRisk: "medium",
    timeOfDay: "morning_or_evening",
    notes: {
      en: {
        critical:
          "Tasselling, silking and grain filling are the make-or-break weeks. A dry spell while the silks are out can cost more yield than drought at any other time.",
        afterRain: "Maize roots deep, so 20 mm or more of rain covers several days. Skip the next watering and check the soil at a hand's depth before resuming.",
        watchFor: "Leaves rolling into tubes before mid-morning mean stress. Yellow lower leaves with a wet, sour-smelling soil mean waterlogging, not drought.",
        practice: "Water less often but deeply so roots follow the water down. Stop irrigating once the kernels have dented and are drying.",
      },
      pcm: {
        critical: "Tassel, silk and grain-filling time na the weeks wey matter pass. If dry spell come when silk dey out, you go lose harvest pass any other time.",
        afterRain: "Maize root dey go deep, so 20 mm rain or more go cover some days. Skip the next watering and check the soil as deep as your hand before you continue.",
        watchFor: "Leaf wey roll like pipe before mid-morning mean say plant dey suffer. Yellow leaf for bottom with wet soil wey dey smell sour na too much water, no be dryness.",
        practice: "Water am small small times but deep, make root follow the water go down. Stop watering when the seed don dent and dey dry.",
      },
    },
    sources: [FAO3_KC, FAO4_SENSITIVITY, FAO4_SCHEDULE],
  },

  // ------------------------------------------------------------------ pulses
  {
    id: "chickpea",
    name: { en: "Chickpea", pcm: "Chickpea" },
    category: "pulse",
    irrigationModelCrop: false,
    waterNeed: "low",
    rooting: "medium",
    kc: kc(0.4, 1.0, 0.35),
    kcBasis: "FAO-56 Table 12, chick pea.",
    droughtSensitivity: "medium",
    criticalStages: ["flowering", "yield_formation"],
    waterloggingRisk: "high",
    timeOfDay: "early_morning",
    notes: {
      en: {
        critical: "Flowering and pod filling. Chickpea tolerates a dry vegetative period well; it is water at podding that sets the yield.",
        afterRain: "Skip watering after any useful rain. Chickpea dislikes wet feet, and a wet canopy during flowering invites fungal blight.",
        watchFor: "Wilting that does not recover overnight. Yellowing and root rot after heavy rain on heavy soil mean the field is too wet, not too dry.",
        practice: "Grow on well-drained land. Water lightly and infrequently; over-watering grows leaves at the expense of pods.",
      },
      pcm: {
        critical: "Flowering and when pod dey fill. Chickpea fit manage dry weather when e still small; na water for podding time dey decide harvest.",
        afterRain: "Skip watering after any correct rain. Chickpea no like wet foot, and wet leaf for flowering time dey bring fungus.",
        watchFor: "If plant weak and e no recover for night. Yellow leaf and rotten root after heavy rain for heavy soil mean say field too wet, no be dry.",
        practice: "Plant am for land wey water dey drain well. Water small and no do am too often; too much water go grow leaf instead of pod.",
      },
    },
    sources: [FAO56_KC, FAO56_ROOTS, FAO4_SENSITIVITY],
  },
  {
    id: "kidneybeans",
    name: { en: "Kidney beans", pcm: "Kidney beans" },
    category: "pulse",
    irrigationModelCrop: false,
    waterNeed: "moderate",
    rooting: "medium",
    kc: kc(0.4, 1.15, 0.35),
    kcBasis: "FAO-56 Table 12, beans dry and pulses.",
    droughtSensitivity: "medium",
    criticalStages: ["flowering", "yield_formation"],
    waterloggingRisk: "high",
    timeOfDay: "early_morning",
    notes: {
      en: {
        critical: "Flowering and pod filling. Stress in these two to three weeks drops flowers and gives small, few-seeded pods.",
        afterRain: "Skip the next watering after 10 mm or more. Beans are among the crops most damaged by standing water.",
        watchFor: "Flower drop and small pods after a dry spell. Yellow, stunted plants on wet ground mean waterlogging.",
        practice: "Keep water off the leaves where you can to limit leaf diseases. Ease off as pods dry down to harvest.",
      },
      pcm: {
        critical: "Flowering and when pod dey fill. If plant suffer for these two-three weeks, flower go fall and pod go small with few seed.",
        afterRain: "Skip the next watering after 10 mm rain or more. Beans na one of the crop wey standing water dey spoil pass.",
        watchFor: "Flower dey fall and pod small after dry spell. Yellow, short plant for wet ground na too much water.",
        practice: "Try no wet the leaf if you fit, so leaf disease no come. Reduce water as pod dey dry for harvest.",
      },
    },
    sources: [FAO56_KC, FAO56_ROOTS, FAO4_SENSITIVITY],
  },
  {
    id: "lentil",
    name: { en: "Lentil", pcm: "Lentil" },
    category: "pulse",
    irrigationModelCrop: false,
    waterNeed: "low",
    rooting: "medium",
    kc: kc(0.4, 1.1, 0.3),
    kcBasis: "FAO-56 Table 12, lentil.",
    droughtSensitivity: "medium",
    criticalStages: ["flowering", "yield_formation"],
    waterloggingRisk: "high",
    timeOfDay: "early_morning",
    notes: {
      en: {
        critical: "Flowering to pod filling. Lentil is a cool, dry-season pulse that needs little water until then.",
        afterRain: "Skip watering after rain; lentil is very intolerant of waterlogging and root rot follows quickly on wet soil.",
        watchFor: "Plants that stay wilted in the morning. Patches dying after rain on heavy ground point to drainage, not drought.",
        practice: "One or two light waterings at flowering and podding are usually enough. Stop once pods start to turn colour.",
      },
      pcm: {
        critical: "From flowering till pod dey fill. Lentil na cool dry-season crop wey no need plenty water before then.",
        afterRain: "Skip watering after rain; lentil no fit bear wet ground at all and root go rot quick for wet soil.",
        watchFor: "Plant wey still weak for morning. If some part dey die after rain for heavy ground, na drainage problem, no be dry.",
        practice: "One or two small watering for flowering and podding dey usually do. Stop when pod begin change colour.",
      },
    },
    sources: [FAO56_KC, FAO56_ROOTS, FAO4_SENSITIVITY],
  },
  {
    id: "mungbean",
    name: { en: "Mung bean", pcm: "Mung bean" },
    category: "pulse",
    irrigationModelCrop: false,
    waterNeed: "low",
    rooting: "medium",
    kc: kc(0.4, 1.05, 0.45),
    kcBasis: "FAO-56 Table 12, green gram and cowpeas (Kc end 0.60-0.35 taken as 0.45).",
    droughtSensitivity: "medium",
    criticalStages: ["flowering", "yield_formation"],
    waterloggingRisk: "high",
    timeOfDay: "early_morning",
    notes: {
      en: {
        critical: "Flowering and pod set. A short-season crop, so one missed watering at flowering shows directly in the harvest.",
        afterRain: "Skip watering after 10 mm or more. Do not let water stand; mung bean wilts and rots in waterlogged soil.",
        watchFor: "Flower drop and leaf yellowing after a dry week. Sudden wilting on wet soil is root rot.",
        practice: "Light, infrequent watering. Withhold water as the first pods blacken so the crop ripens evenly.",
      },
      pcm: {
        critical: "Flowering and when pod dey form. Na short crop, so if you miss one watering for flowering e go show for harvest.",
        afterRain: "Skip watering after 10 mm rain or more. No allow water stand; mung bean dey weak and rot for waterlogged soil.",
        watchFor: "Flower dey fall and leaf dey yellow after one dry week. If plant weak suddenly for wet soil, na root rot.",
        practice: "Water small and no do am often. Stop water when the first pod turn black so everything go ripe together.",
      },
    },
    sources: [FAO56_KC, FAO56_ROOTS, FAO4_SENSITIVITY],
  },
  {
    id: "blackgram",
    name: { en: "Black gram", pcm: "Black gram" },
    category: "pulse",
    irrigationModelCrop: false,
    waterNeed: "low",
    rooting: "medium",
    kc: kc(0.4, 1.05, 0.45),
    kcBasis: "FAO-56 Table 12 has no black gram entry; green gram (same Vigna group) used as the proxy.",
    droughtSensitivity: "medium",
    criticalStages: ["flowering", "yield_formation"],
    waterloggingRisk: "high",
    timeOfDay: "early_morning",
    notes: {
      en: {
        critical: "Flowering and pod formation are the two critical moments; stress then cuts pods per plant and seeds per pod.",
        afterRain: "Skip watering after rain. Black gram is sensitive to waterlogging at every stage: it brings root rot and poor nodulation.",
        watchFor: "Wilting in the morning, flower drop. Yellowing after rain on clay is a drainage problem.",
        practice: "Grow on free-draining soil and water sparingly. Stop as pods mature.",
      },
      pcm: {
        critical: "Flowering and when pod dey form na the two important time; if plant suffer then, pod per plant and seed per pod go reduce.",
        afterRain: "Skip watering after rain. Black gram no fit bear waterlogging for any stage: e dey bring root rot and bad nodule.",
        watchFor: "Plant weak for morning, flower dey fall. Yellow leaf after rain for clay soil na drainage problem.",
        practice: "Plant am for soil wey water dey pass well and water am small. Stop when pod don mature.",
      },
    },
    sources: [FAO56_KC, BLACKGRAM, FAO4_SENSITIVITY],
  },
  {
    id: "mothbeans",
    name: { en: "Moth beans", pcm: "Moth beans" },
    category: "pulse",
    irrigationModelCrop: false,
    waterNeed: "low",
    rooting: "medium",
    kc: kc(0.4, 1.0, 0.4),
    kcBasis: "FAO-56 Table 12 has no moth bean entry; green gram used as the proxy with a lower mid-season value for this sparse-canopy, drought-hardy species.",
    droughtSensitivity: "low",
    criticalStages: ["flowering"],
    waterloggingRisk: "high",
    timeOfDay: "early_morning",
    notes: {
      en: {
        critical:
          "Moth bean is the hardiest of the pulses; it yields on 200-300 mm a season and its taproot reaches deep moisture. If any watering is given, give it at flowering.",
        afterRain: "Skip watering entirely after rain. This crop suffers far more from wet soil than from dry.",
        watchFor: "Severe wilting that lasts past sunset. Otherwise trust the plant; it adjusts its own maturity to the moisture available.",
        practice: "Usually grown without irrigation. Never water in the dry season unless the crop is visibly failing at flowering.",
      },
      pcm: {
        critical:
          "Moth bean na the strongest of all the beans; e dey give harvest with 200-300 mm rain for season and the root dey reach water for deep ground. If you go water am at all, water am for flowering.",
        afterRain: "Skip watering completely after rain. This crop dey suffer more from wet soil than dry soil.",
        watchFor: "Serious wilting wey pass sunset. If not, trust the plant; e dey adjust when e go ripe according to the water wey dey.",
        practice: "Dem dey usually grow am without irrigation. No water am for dry season unless the crop dey clearly fail for flowering.",
      },
    },
    sources: [FEEDIPEDIA_MOTHBEAN, MOTHBEAN_REVIEW, FAO56_KC],
  },
  {
    id: "pigeonpeas",
    name: { en: "Pigeon peas", pcm: "Pigeon peas" },
    category: "pulse",
    irrigationModelCrop: false,
    waterNeed: "low",
    rooting: "deep",
    kc: kc(0.4, 1.1, 0.4),
    kcBasis: "FAO-56 Table 12 has no pigeon pea entry; beans dry and pulses used as the proxy with a mid-season value between beans and chickpea for this tall, long-duration crop.",
    droughtSensitivity: "low",
    criticalStages: ["flowering", "yield_formation"],
    waterloggingRisk: "high",
    timeOfDay: "early_morning",
    notes: {
      en: {
        critical:
          "Pre-flowering and pod development. A deep taproot carries pigeon pea through drought, but a dry spell at branching, flowering or podding still costs pods.",
        afterRain: "Skip watering after rain. Rain during flowering itself spoils pollination, and waterlogged soil is unfit for this crop.",
        watchFor: "Flower and pod drop after a dry spell. Yellowing and death of plants in low, wet spots mean waterlogging.",
        practice: "In a long dry spell, three waterings, at branching, flowering and podding, are enough. Plant on ridges where drainage is poor.",
      },
      pcm: {
        critical:
          "Before flowering and when pod dey develop. Deep root dey carry pigeon pea through dry season, but dry spell for branching, flowering or podding still dey reduce pod.",
        afterRain: "Skip watering after rain. Rain for flowering time itself dey spoil pollination, and waterlogged soil no good for this crop.",
        watchFor: "Flower and pod dey fall after dry spell. Yellow leaf and plant dey die for low wet places na waterlogging.",
        practice: "For long dry spell, three watering dey do: for branching, flowering and podding. Plant am on ridge where drainage no good.",
      },
    },
    sources: [VIKASPEDIA_PIGEONPEA, FAO56_KC, FAO4_SENSITIVITY],
  },

  // -------------------------------------------------------------- fruit trees
  {
    id: "apple",
    name: { en: "Apple", pcm: "Apple" },
    category: "fruit_tree",
    irrigationModelCrop: false,
    waterNeed: "moderate",
    rooting: "deep",
    kc: kc(0.6, 0.95, 0.75),
    kcBasis: "FAO-56 Table 12, apples with ground cover (Kc ini 0.45-0.80 and Kc end 0.70-0.85 taken at mid-range).",
    droughtSensitivity: "medium",
    criticalStages: ["flowering", "yield_formation"],
    waterloggingRisk: "medium",
    timeOfDay: "morning_or_evening",
    notes: {
      en: {
        critical: "Fruit set and the rapid fruit-growth weeks. Stress then gives small fruit and heavy June drop.",
        afterRain: "Apple roots deep; 20 mm of rain covers several days. Resume only when the soil is dry at a hand's depth.",
        watchFor: "Small, early-dropping fruit and dull leaves. Yellow leaves on constantly wet ground point to root damage.",
        practice: "Deep, infrequent watering of the whole root zone. Reduce water in the final weeks before picking to improve flavour and storage.",
      },
      pcm: {
        critical: "When fruit dey set and the weeks wey fruit dey grow fast. If tree suffer then, fruit go small and plenty go fall.",
        afterRain: "Apple root dey deep; 20 mm rain go cover some days. Continue only when soil dry as deep as your hand.",
        watchFor: "Small fruit wey dey fall early and dull leaf. Yellow leaf for ground wey always wet na root damage.",
        practice: "Water deep, no do am often, cover the whole root area. Reduce water for the last weeks before you pick so the taste and storage go better.",
      },
    },
    sources: [FAO56_KC, FAO56_ROOTS, FAO4_SCHEDULE],
  },
  {
    id: "orange",
    name: { en: "Orange", pcm: "Orange" },
    category: "fruit_tree",
    irrigationModelCrop: false,
    waterNeed: "moderate",
    rooting: "deep",
    kc: kc(0.7, 0.65, 0.7),
    kcBasis: "FAO-56 Table 12, citrus with active ground cover (mid-range of 0.75-0.85 / 0.70-0.85 / 0.75-0.85, reduced slightly for partial cover).",
    droughtSensitivity: "medium",
    criticalStages: ["flowering", "yield_formation"],
    waterloggingRisk: "medium",
    timeOfDay: "morning_or_evening",
    notes: {
      en: {
        critical: "Flowering and fruit set matter more than fruit enlargement. Drought at flowering drops the young fruit that would have been the crop.",
        afterRain: "Skip watering after 15 mm or more. Citrus roots run wide and deep, so rain lasts several days.",
        watchFor: "Leaf curl and fruit drop in the dry season. Yellow veins and dieback on wet, heavy soil mean root rot from waterlogging.",
        practice: "Water the drip line of the canopy, not the trunk. Keep the soil evenly moist from flowering through fruit set; irregular watering causes fruit splitting later.",
      },
      pcm: {
        critical: "Flowering and fruit set dey matter pass when fruit dey grow big. Dry weather for flowering dey make the small fruit fall.",
        afterRain: "Skip watering after 15 mm rain or more. Orange root dey spread wide and deep, so rain dey last some days.",
        watchFor: "Leaf dey curl and fruit dey fall for dry season. Yellow vein and branch wey dey die for wet heavy soil na root rot from too much water.",
        practice: "Water where the branch end reach for ground, no be the trunk. Keep soil moist steady from flowering till fruit set; if you water anyhow, fruit go split later.",
      },
    },
    sources: [FAO56_KC, FAO56_ROOTS, FAO4_SENSITIVITY],
  },
  {
    id: "mango",
    name: { en: "Mango", pcm: "Mango" },
    category: "fruit_tree",
    irrigationModelCrop: false,
    waterNeed: "low",
    rooting: "deep",
    kc: { initial: 0.4, development: 0.6, mid: 0.8, late: 0.65 },
    kcBasis: "FAO-56 has no mango entry; Carr's review reports Kc rising from about 0.4 at flowering to 0.8 during fruit growth, within a 0.65-1.05 range.",
    droughtSensitivity: "low",
    criticalStages: ["yield_formation"],
    waterloggingRisk: "medium",
    timeOfDay: "morning_or_evening",
    notes: {
      en: {
        critical:
          "Fruit growth after fruit set. Mango needs a dry spell of about six weeks before flowering to flower well, so do not water a bearing tree in that window; start again once fruit has set.",
        afterRain: "Skip watering after rain. A mature tree's roots reach deep moisture and rain during fruit growth is welcome.",
        watchFor: "Heavy fruit drop and shrivelling in the weeks after fruit set. Constant wet ground reduces flowering and invites root disease.",
        practice: "Two or three good waterings after fruit set, then deep watering every one to two weeks in the dry season until the fruit is nearly full size.",
      },
      pcm: {
        critical:
          "When fruit dey grow after fruit set. Mango need about six weeks dry spell before flowering so e go flower well, so no water tree wey dey bear for that time; start again when fruit don set.",
        afterRain: "Skip watering after rain. Big tree root dey reach deep water and rain during fruit growth good.",
        watchFor: "Plenty fruit dey fall and dey shrink for the weeks after fruit set. Ground wey always wet dey reduce flowering and dey bring root disease.",
        practice: "Two or three good watering after fruit set, then deep watering every one to two weeks for dry season until fruit almost full size.",
      },
    },
    sources: [CARR_MANGO, FAO4_SCHEDULE],
  },
  {
    id: "pomegranate",
    name: { en: "Pomegranate", pcm: "Pomegranate" },
    category: "fruit_tree",
    irrigationModelCrop: false,
    waterNeed: "low",
    rooting: "deep",
    kc: { initial: 0.35, development: 0.55, mid: 0.75, late: 0.6 },
    kcBasis: "FAO-56 has no pomegranate entry; a measured Kc rising from 0.32 to a peak of 0.74 in mid-season is used.",
    droughtSensitivity: "low",
    criticalStages: ["yield_formation", "ripening"],
    waterloggingRisk: "medium",
    timeOfDay: "morning_or_evening",
    notes: {
      en: {
        critical:
          "Fruit development and ripening, but for regularity rather than quantity: pomegranate tolerates drought, yet irregular or heavy watering while fruit ripens cracks the fruit.",
        afterRain: "Skip watering after rain, and do not follow a dry spell with a heavy watering during ripening; that swing is what splits the fruit.",
        watchFor: "Cracked fruit means uneven water, not too little. Leaf drop in the dry season means too little.",
        practice: "Moderate, even watering at a steady interval through fruit growth. Lengthen the interval as fruit ripens.",
      },
      pcm: {
        critical:
          "When fruit dey develop and dey ripe, but na steady water e need, no be plenty: pomegranate fit bear dry weather, but if you water anyhow or too much when fruit dey ripe, fruit go crack.",
        afterRain: "Skip watering after rain, and no follow dry spell with heavy watering when fruit dey ripe; na that up-and-down dey split the fruit.",
        watchFor: "Fruit wey crack mean say water no steady, no be say e small. Leaf dey fall for dry season mean say water small.",
        practice: "Medium, steady watering with the same interval as fruit dey grow. Space the watering more as fruit dey ripe.",
      },
    },
    sources: [POMEGRANATE_KC, POMEGRANATE_CRACKING],
  },
  {
    id: "papaya",
    name: { en: "Papaya (pawpaw)", pcm: "Pawpaw" },
    category: "fruit_tree",
    irrigationModelCrop: false,
    waterNeed: "high",
    rooting: "shallow",
    kc: { initial: 0.5, development: 0.75, mid: 1.0, late: 0.95 },
    kcBasis: "No reliable published Kc for papaya (Carr); banana first-year values are used as the proxy for a similar large-leaved, shallow-rooted, continuously fruiting plant.",
    droughtSensitivity: "high",
    criticalStages: ["flowering", "yield_formation"],
    waterloggingRisk: "high",
    timeOfDay: "morning_or_evening",
    notes: {
      en: {
        critical:
          "Papaya flowers and fruits continuously, so it has no off-season: every dry week costs fruit. Effective roots reach only about 0.55 m, so it cannot draw on deep moisture.",
        afterRain: "Skip watering after rain and make sure water drains away within a day. Papaya is very sensitive to waterlogging; a flooded root zone kills the plant quickly.",
        watchFor: "Wilting leaves, small fruit and flower drop in the dry season. Yellowing and collapse after heavy rain is root rot from standing water.",
        practice: "Frequent, light watering rather than occasional flooding. Plant on ridges or mounds where the ground can hold water.",
      },
      pcm: {
        critical:
          "Pawpaw dey flower and bear fruit all the time, so e no get rest season: every dry week dey cost fruit. The root dey reach only about 0.55 m, so e no fit draw deep water.",
        afterRain: "Skip watering after rain and make sure water drain away inside one day. Pawpaw no fit bear waterlogging at all; if root area flood, plant go die quick.",
        watchFor: "Leaf dey weak, fruit small and flower dey fall for dry season. Yellow leaf and plant collapse after heavy rain na root rot from standing water.",
        practice: "Water am small small but often, no be flooding once in a while. Plant am on ridge or mound where ground fit hold water.",
      },
    },
    sources: [CARR_PAPAYA, PLANTVILLAGE_PAPAYA, FAO56_KC],
  },
  {
    id: "banana",
    name: { en: "Banana", pcm: "Banana" },
    category: "fruit_tree",
    irrigationModelCrop: false,
    waterNeed: "high",
    rooting: "medium",
    kc: kc(0.5, 1.1, 1.0),
    kcBasis: "FAO-56 Table 12, banana first year (second-year plantations run higher: 1.00 / 1.20 / 1.10).",
    droughtSensitivity: "high",
    criticalStages: ["establishment", "vegetative", "flowering", "yield_formation"],
    waterloggingRisk: "medium",
    timeOfDay: "morning_or_evening",
    notes: {
      en: {
        critical: "Throughout. FAO rates banana as sensitive to water shortage at every stage; the huge leaves lose water fast and the roots are shallow.",
        afterRain: "Skip watering after 15 mm or more, but check that the mat drains; banana wants moist soil, not standing water.",
        watchFor: "Leaves folding along the midrib and yellowing edges in the dry season. Choked, slow-emerging bunches are a sign of stress at flowering.",
        practice: "Keep the soil moist all year; in the dry season this means watering every few days on light soil. Mulch heavily to hold moisture.",
      },
      pcm: {
        critical: "Every stage. FAO say banana no fit bear water shortage for any stage; the big leaf dey lose water fast and root no deep.",
        afterRain: "Skip watering after 15 mm rain or more, but check say the water dey drain; banana want moist soil, no be standing water.",
        watchFor: "Leaf dey fold for the middle line and edge dey yellow for dry season. Bunch wey no dey come out well na sign say plant suffer for flowering.",
        practice: "Keep soil moist all year; for dry season that mean watering every few days for light soil. Put plenty mulch make water stay.",
      },
    },
    sources: [FAO56_KC, FAO56_ROOTS, FAO4_SENSITIVITY],
  },
  {
    id: "grapes",
    name: { en: "Grapes", pcm: "Grapes" },
    category: "fruit_vine",
    irrigationModelCrop: false,
    waterNeed: "low",
    rooting: "deep",
    kc: kc(0.3, 0.8, 0.45),
    kcBasis: "FAO-56 Table 12, grapes (table grapes, Kc mid 0.85; wine grapes 0.70).",
    droughtSensitivity: "low",
    criticalStages: ["flowering", "yield_formation"],
    waterloggingRisk: "medium",
    timeOfDay: "early_morning",
    notes: {
      en: {
        critical: "Flowering, fruit set and berry sizing. After the berries soften, mild stress improves sugar and flavour.",
        afterRain: "Skip watering after rain. Wet foliage around ripening invites bunch rot, so keep water on the ground, not the canopy.",
        watchFor: "Wilting tendrils and small berries. Vigorous, leafy vines with poor fruit are over-watered.",
        practice: "Deep, infrequent watering. Cut back from the start of ripening until harvest.",
      },
      pcm: {
        critical: "Flowering, fruit set and when berry dey grow big. After berry soft, small dryness dey make am sweeter.",
        afterRain: "Skip watering after rain. Wet leaf near ripening time dey bring bunch rot, so put water for ground, no be on top the leaf.",
        watchFor: "Tendril dey weak and berry small. Vine wey get plenty leaf but poor fruit don get too much water.",
        practice: "Water deep, no do am often. Reduce from when ripening start until harvest.",
      },
    },
    sources: [FAO56_KC, FAO56_ROOTS, FAO4_SCHEDULE],
  },
  {
    id: "watermelon",
    name: { en: "Watermelon", pcm: "Watermelon" },
    category: "fruit_vine",
    irrigationModelCrop: false,
    waterNeed: "moderate",
    rooting: "deep",
    kc: kc(0.4, 1.0, 0.75),
    kcBasis: "FAO-56 Table 12, watermelon.",
    droughtSensitivity: "high",
    criticalStages: ["flowering", "yield_formation"],
    waterloggingRisk: "high",
    timeOfDay: "early_morning",
    notes: {
      en: {
        critical: "Flowering and fruit filling. FAO rates watermelon as highly sensitive to shortage in these weeks; fruit stays small or splits later.",
        afterRain: "Skip watering after rain. Standing water rots the vines and fruit; make sure beds drain.",
        watchFor: "Wilting at midday that recovers by evening is normal in heat; wilting that persists is not. Fruit cracking follows heavy water after a dry spell.",
        practice: "Water at the base, keep leaves dry. Stop watering about a week before harvest for sweeter, firmer fruit.",
      },
      pcm: {
        critical: "Flowering and when fruit dey fill. FAO say watermelon no fit bear water shortage for these weeks; fruit go stay small or split later.",
        afterRain: "Skip watering after rain. Standing water dey rot vine and fruit; make sure bed dey drain.",
        watchFor: "Wilting for afternoon wey recover for evening na normal for heat; wilting wey stay no be normal. Fruit dey crack when heavy water follow dry spell.",
        practice: "Water for the base, keep leaf dry. Stop watering about one week before harvest so fruit go sweeter and firmer.",
      },
    },
    sources: [FAO56_KC, FAO56_ROOTS, FAO4_SENSITIVITY],
  },
  {
    id: "muskmelon",
    name: { en: "Muskmelon", pcm: "Muskmelon" },
    category: "fruit_vine",
    irrigationModelCrop: false,
    waterNeed: "moderate",
    rooting: "deep",
    kc: kc(0.5, 0.85, 0.6),
    kcBasis: "FAO-56 Table 12, cantaloupe.",
    droughtSensitivity: "high",
    criticalStages: ["flowering", "yield_formation"],
    waterloggingRisk: "high",
    timeOfDay: "early_morning",
    notes: {
      en: {
        critical: "Flowering and fruit filling, as for watermelon.",
        afterRain: "Skip watering after rain and keep the beds drained; wet foliage and soil bring mildew and fruit rot.",
        watchFor: "Persistent wilting, small fruit. Fruit with poor flavour after heavy late watering.",
        practice: "Water at the base in the morning so leaves dry quickly. Reduce water as the fruit nets and ripens.",
      },
      pcm: {
        critical: "Flowering and when fruit dey fill, same as watermelon.",
        afterRain: "Skip watering after rain and keep bed drained; wet leaf and soil dey bring mildew and fruit rot.",
        watchFor: "Plant wey stay weak, small fruit. Fruit wey no sweet after heavy late watering.",
        practice: "Water for base for morning so leaf go dry quick. Reduce water as fruit dey net and ripe.",
      },
    },
    sources: [FAO56_KC, FAO56_ROOTS, FAO4_SENSITIVITY],
  },

  // -------------------------------------------------------------- plantation
  {
    id: "coconut",
    name: { en: "Coconut", pcm: "Coconut" },
    category: "plantation",
    irrigationModelCrop: false,
    waterNeed: "moderate",
    rooting: "medium",
    kc: kc(0.95, 1.0, 1.0),
    kcBasis: "FAO-56 Table 12, palm trees.",
    droughtSensitivity: "medium",
    criticalStages: ["flowering", "yield_formation"],
    waterloggingRisk: "low",
    timeOfDay: "morning_or_evening",
    notes: {
      en: {
        critical:
          "The palm carries flowers and nuts at all stages at once, so a dry spell shows months later as button shedding and immature nut fall. Irrigation raises female flower production and cuts premature nut fall.",
        afterRain: "Skip watering after rain. Coconut tolerates wet ground well but not stagnant water for weeks.",
        watchFor: "Drooping fronds, immature nuts on the ground and a thinning crown in the dry season.",
        practice: "Basin irrigation of about 200 litres per palm every four days in the dry season, or daily drip of about 30 litres per palm, as the CPCRI norm.",
      },
      pcm: {
        critical:
          "The palm dey carry flower and nut for all stages same time, so dry spell go show months later as small nut dey fall. Irrigation dey increase female flower and dey reduce nut wey fall before time.",
        afterRain: "Skip watering after rain. Coconut fit bear wet ground well but no be water wey stand for weeks.",
        watchFor: "Frond dey droop, small nut for ground and crown wey dey thin for dry season.",
        practice: "Basin watering about 200 litre for each palm every four days for dry season, or daily drip about 30 litre per palm, as CPCRI recommend.",
      },
    },
    sources: [FAO56_KC, CPCRI_COCONUT, TNAU_COCONUT],
  },
  {
    id: "coffee",
    name: { en: "Coffee", pcm: "Coffee" },
    category: "plantation",
    irrigationModelCrop: false,
    waterNeed: "moderate",
    rooting: "deep",
    kc: kc(0.9, 0.95, 0.95),
    kcBasis: "FAO-56 Table 12, coffee with bare ground cover (with weeds: 1.05 / 1.10 / 1.10).",
    droughtSensitivity: "medium",
    criticalStages: ["flowering", "yield_formation"],
    waterloggingRisk: "medium",
    timeOfDay: "morning_or_evening",
    notes: {
      en: {
        critical:
          "Flowering and berry expansion. Like mango, coffee needs a dry rest to set flower buds, then water (or rain) to trigger blossom; irrigation after the blossom shower sets the crop.",
        afterRain: "Skip watering after rain. Shade and mulch matter as much as irrigation for keeping the root zone moist.",
        watchFor: "Leaf drop and shrivelled green berries in the dry season. Yellowing on wet, compacted ground is root stress from waterlogging.",
        practice: "Withhold water in the pre-flowering dry rest, then water every one to two weeks through berry expansion. Keep the ground mulched.",
      },
      pcm: {
        critical:
          "Flowering and when berry dey grow big. Like mango, coffee need dry rest to form flower bud, then water (or rain) make e blossom; watering after the blossom rain dey set the crop.",
        afterRain: "Skip watering after rain. Shade and mulch dey matter as much as watering to keep root area moist.",
        watchFor: "Leaf dey fall and green berry dey shrink for dry season. Yellow leaf for wet hard ground na root stress from too much water.",
        practice: "Hold water for the dry rest before flowering, then water every one to two weeks as berry dey grow. Keep ground with mulch.",
      },
    },
    sources: [FAO56_KC, FAO56_ROOTS, FAO4_SCHEDULE],
  },

  // -------------------------------------------------------------------- fibre
  {
    id: "cotton",
    name: { en: "Cotton", pcm: "Cotton" },
    category: "fibre",
    irrigationModelCrop: false,
    waterNeed: "moderate",
    rooting: "deep",
    kc: kc(0.35, 1.17, 0.6),
    kcBasis: "FAO-56 Table 12, cotton (Kc mid 1.15-1.20 and Kc end 0.70-0.50 taken at mid-range).",
    droughtSensitivity: "low",
    criticalStages: ["flowering", "yield_formation"],
    waterloggingRisk: "medium",
    timeOfDay: "morning_or_evening",
    notes: {
      en: {
        critical: "Flowering and boll formation. Cotton rates as low drought sensitivity overall, but shortage in these weeks sheds squares and young bolls.",
        afterRain: "Skip watering after 20 mm or more; cotton roots deep. Avoid wetting open bolls, which stains the lint.",
        watchFor: "Reddening leaves and shed squares after a dry spell. Rank, leafy growth with few bolls means too much water or nitrogen.",
        practice: "Deep, infrequent watering. Stop irrigating once the first bolls open so the crop dries down for picking.",
      },
      pcm: {
        critical: "Flowering and when boll dey form. Cotton fit manage dry weather in general, but shortage for these weeks dey make square and young boll fall.",
        afterRain: "Skip watering after 20 mm rain or more; cotton root deep. No wet boll wey don open, e dey stain the lint.",
        watchFor: "Leaf dey turn red and square dey fall after dry spell. Plant wey get plenty leaf but few boll don get too much water or nitrogen.",
        practice: "Water deep, no do am often. Stop watering when the first boll open so crop go dry for picking.",
      },
    },
    sources: [FAO56_KC, FAO56_ROOTS, FAO4_SENSITIVITY],
  },
  {
    id: "jute",
    name: { en: "Jute", pcm: "Jute" },
    category: "fibre",
    irrigationModelCrop: false,
    waterNeed: "high",
    rooting: "medium",
    kc: { initial: 0.4, development: 0.75, mid: 1.1, late: 0.9 },
    kcBasis: "FAO-56 has no jute entry; a tall, dense-canopy fibre crop profile between cotton and a leafy vegetable is used, consistent with a 500 mm seasonal need.",
    droughtSensitivity: "medium",
    criticalStages: ["establishment", "vegetative"],
    waterloggingRisk: "high",
    timeOfDay: "morning_or_evening",
    notes: {
      en: {
        critical:
          "Germination and the knee-high stage. Jute needs about 500 mm over the season; a pre-sowing watering and three after sowing raise early fibre yield.",
        afterRain: "Skip watering after rain, and drain fast: seedlings of both jute species die in standing water, and tossa jute will not stand water at any age.",
        watchFor: "Stunted, pale seedlings on wet ground mean waterlogging. Wilting in the afternoon that persists means the crop is dry.",
        practice: "Water about every 15 days in dry weather once established. Grow on land that sheds water within two to three days of heavy rain.",
      },
      pcm: {
        critical:
          "Germination and knee-high stage. Jute need about 500 mm for the season; one watering before sowing and three after sowing dey increase early fibre.",
        afterRain: "Skip watering after rain, and drain fast: small jute of both type dey die for standing water, and tossa jute no fit stand water at any age.",
        watchFor: "Small pale seedling for wet ground na waterlogging. Wilting for afternoon wey no stop mean say crop dry.",
        practice: "Water about every 15 days for dry weather when e don establish. Plant am for land wey water dey leave inside two-three days after heavy rain.",
      },
    },
    sources: [PROSEA_JUTE, JUTE_WATERLOGGING, FAO3_KC],
  },

  // ------------------------------------------ irrigation-model crops (five)
  {
    id: "carrot",
    name: { en: "Carrot", pcm: "Carrot" },
    category: "vegetable",
    irrigationModelCrop: true,
    waterNeed: "moderate",
    rooting: "medium",
    kc: kc(0.7, 1.05, 0.95),
    kcBasis: "FAO-56 Table 12, carrots.",
    droughtSensitivity: "medium",
    criticalStages: ["establishment", "yield_formation"],
    waterloggingRisk: "medium",
    timeOfDay: "early_morning",
    notes: {
      en: {
        critical: "Germination (the seed bed must stay moist for up to two weeks) and root swelling. Uneven water while roots swell splits and forks them.",
        afterRain: "Skip watering after 10 mm or more, and avoid a heavy watering straight after a dry spell; that is what cracks the roots.",
        watchFor: "Split or forked roots mean uneven water. Crusted, dry seed beds mean seedlings will not emerge.",
        practice: "Frequent light watering until emergence, then steady, even moisture. Ease off in the last two weeks before lifting.",
      },
      pcm: {
        critical: "Germination (seed bed must stay moist up to two weeks) and when root dey swell. If water no steady when root dey swell, root go split and fork.",
        afterRain: "Skip watering after 10 mm rain or more, and no do heavy watering straight after dry spell; na that one dey crack the root.",
        watchFor: "Root wey split or fork mean say water no steady. Seed bed wey hard and dry mean say seedling no go come out.",
        practice: "Small watering often until seedling come out, then steady moisture. Reduce for the last two weeks before you harvest.",
      },
    },
    sources: [FAO56_KC, FAO56_ROOTS, FAO4_SCHEDULE],
  },
  {
    id: "chilli",
    name: { en: "Chilli pepper", pcm: "Pepper (chilli)" },
    category: "vegetable",
    irrigationModelCrop: true,
    waterNeed: "moderate",
    rooting: "medium",
    kc: kc(0.6, 1.05, 0.9),
    kcBasis: "FAO-56 Table 12, sweet peppers (bell); FAO-4 rates pepper as sensitive throughout.",
    droughtSensitivity: "high",
    criticalStages: ["establishment", "flowering", "yield_formation"],
    waterloggingRisk: "high",
    timeOfDay: "early_morning",
    notes: {
      en: {
        critical: "Throughout, and especially flowering and fruit set: a dry spell then drops flowers and gives blossom-end rot on the fruit.",
        afterRain: "Skip watering after 10 mm or more. Pepper is very intolerant of waterlogging; drain beds quickly.",
        watchFor: "Flower drop and sunken, dark patches on fruit ends after dry spells. Wilting on wet soil is root disease, not thirst.",
        practice: "Steady, even moisture; never let the bed dry out fully then flood it. Water the base in the morning so foliage dries.",
      },
      pcm: {
        critical: "Every stage, especially flowering and fruit set: dry spell then dey make flower fall and dey give black rot for the fruit bottom.",
        afterRain: "Skip watering after 10 mm rain or more. Pepper no fit bear waterlogging at all; drain the bed quick.",
        watchFor: "Flower dey fall and dark sunken mark for fruit bottom after dry spell. Wilting for wet soil na root disease, no be thirst.",
        practice: "Steady moisture; never allow bed dry finish then flood am. Water the base for morning so leaf go dry.",
      },
    },
    sources: [FAO56_KC, FAO56_ROOTS, FAO4_SENSITIVITY],
  },
  {
    id: "potato",
    name: { en: "Potato", pcm: "Irish potato" },
    category: "vegetable",
    irrigationModelCrop: true,
    waterNeed: "high",
    rooting: "shallow",
    kc: kc(0.5, 1.15, 0.75),
    kcBasis: "FAO-56 Table 12, potato.",
    droughtSensitivity: "high",
    criticalStages: ["vegetative", "yield_formation"],
    waterloggingRisk: "high",
    timeOfDay: "early_morning",
    notes: {
      en: {
        critical: "Stolon formation and tuber initiation, then tuber bulking. FAO rates potato as highly sensitive; its roots reach only 0.4-0.6 m so it cannot draw on deep moisture.",
        afterRain: "Skip watering after 10 mm or more. Waterlogged ridges rot the tubers within days.",
        watchFor: "Wilting by mid-morning and small, knobbly tubers. Rotting tubers and a sour smell mean standing water.",
        practice: "Frequent, moderate watering to keep the ridge evenly moist from tuber initiation to two weeks before harvest, then stop so the skins set.",
      },
      pcm: {
        critical: "When stolon and tuber dey start, then when tuber dey grow big. FAO say potato no fit bear water shortage; root reach only 0.4-0.6 m so e no fit draw deep water.",
        afterRain: "Skip watering after 10 mm rain or more. Ridge wey waterlog dey rot the tuber inside days.",
        watchFor: "Wilting by mid-morning and small rough tuber. Tuber wey dey rot and sour smell na standing water.",
        practice: "Medium watering often to keep the ridge moist from when tuber start till two weeks before harvest, then stop so the skin go set.",
      },
    },
    sources: [FAO56_KC, FAO56_ROOTS, FAO4_SENSITIVITY],
  },
  {
    id: "tomato",
    name: { en: "Tomato", pcm: "Tomato" },
    category: "vegetable",
    irrigationModelCrop: true,
    waterNeed: "moderate",
    rooting: "medium",
    kc: kc(0.6, 1.15, 0.8),
    kcBasis: "FAO-56 Table 12, tomato (Kc end 0.70-0.90 taken as 0.80).",
    droughtSensitivity: "high",
    criticalStages: ["flowering", "yield_formation"],
    waterloggingRisk: "high",
    timeOfDay: "early_morning",
    notes: {
      en: {
        critical: "Flowering more than fruit formation. FAO rates tomato as highly sensitive; stress at flowering drops blossoms and uneven water later cracks the fruit and causes blossom-end rot.",
        afterRain: "Skip watering after 10 mm or more and keep water off the leaves; wet foliage in the evening brings blight.",
        watchFor: "Cracked fruit and dark sunken fruit ends mean uneven water. Yellow, wilting plants on wet ground mean waterlogging or root disease.",
        practice: "Water at the base early in the morning, evenly and regularly. Reduce slightly as the last trusses ripen.",
      },
      pcm: {
        critical: "Flowering pass when fruit dey form. FAO say tomato no fit bear water shortage; if plant suffer for flowering, flower go fall, and if water no steady later, fruit go crack and bottom go rot.",
        afterRain: "Skip watering after 10 mm rain or more and keep water off the leaf; wet leaf for evening dey bring blight.",
        watchFor: "Fruit wey crack and dark sunken bottom mean say water no steady. Yellow weak plant for wet ground na waterlogging or root disease.",
        practice: "Water the base early morning, steady and regular. Reduce small as the last fruit dey ripe.",
      },
    },
    sources: [FAO56_KC, FAO56_ROOTS, FAO4_SENSITIVITY, AGRIC_NG_TIMING],
  },
  {
    id: "wheat",
    name: { en: "Wheat", pcm: "Wheat" },
    category: "cereal",
    irrigationModelCrop: true,
    waterNeed: "moderate",
    rooting: "deep",
    kc: kc(0.3, 1.15, 0.33),
    kcBasis: "FAO-56 Table 12, spring wheat (Kc end 0.25-0.41 taken as 0.33).",
    droughtSensitivity: "medium",
    criticalStages: ["flowering", "yield_formation"],
    waterloggingRisk: "medium",
    timeOfDay: "morning_or_evening",
    notes: {
      en: {
        critical: "Flowering more than grain filling, with crown-root initiation about three weeks after sowing a close second.",
        afterRain: "Skip watering after 20 mm or more; wheat roots deep. Do not water once the crop turns golden.",
        watchFor: "Rolled, bluish leaves and thin heads after a dry spell. Yellowing in low patches after rain is waterlogging.",
        practice: "Deep waterings at crown-root initiation, tillering, flowering and grain filling cover most seasons. Stop at ripening.",
      },
      pcm: {
        critical: "Flowering pass grain filling, and crown-root time about three weeks after sowing dey follow close.",
        afterRain: "Skip watering after 20 mm rain or more; wheat root deep. No water again when crop turn golden.",
        watchFor: "Leaf wey roll and look blue, and thin head after dry spell. Yellow patch for low ground after rain na waterlogging.",
        practice: "Deep watering for crown-root time, tillering, flowering and grain filling dey cover most season. Stop for ripening.",
      },
    },
    sources: [FAO56_KC, FAO56_ROOTS, FAO4_SENSITIVITY],
  },
];

export const cropGuidanceById: ReadonlyMap<string, CropGuidance> = new Map(cropGuidance.map((crop) => [crop.id, crop]));

/** Resolves a recommender class name or an irrigation crop name to its guidance. */
export function findCropGuidance(name: string): CropGuidance | undefined {
  return cropGuidanceById.get(name.trim().toLowerCase());
}

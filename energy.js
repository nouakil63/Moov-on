/* Moov'On — règles de démonstration proposées, à valider par la plateforme.
 * Calculs purs : aucun stockage, réseau, paiement ou mesure physiologique.
 * Les valeurs monétaires d'une activité doivent être figées par le registre appelant. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Energy = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LIMIT = Number.MAX_SAFE_INTEGER;
  const DAY = 86400000;
  const SPORTS = ['Course', 'Marche', 'Vélo'];
  const copy = value => JSON.parse(JSON.stringify(value));
  const fail = message => { throw new Error(message); };
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

  function freeze(value) {
    Object.values(value).forEach(item => { if (item && typeof item === 'object') freeze(item); });
    return Object.freeze(value);
  }
  function object(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label + ' doit être un objet.');
    return value;
  }
  function number(value, label, {min = 0, exclusive = false, max = LIMIT, integer = false} = {}) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value > max ||
        (exclusive ? value <= min : value < min) || (integer && !Number.isSafeInteger(value))) {
      fail(label + ' doit être un nombre ' + (integer ? 'entier ' : '') +
        (exclusive ? 'strictement positif' : 'positif ou nul') + ', fini et dans les limites autorisées.');
    }
    return value;
  }
  function positive(value, label) { return number(value, label, {exclusive:true}); }
  function safe(value, label) {
    if (!Number.isFinite(value) || value < 0 || value > LIMIT) fail(label + ' dépasse la précision numérique autorisée.');
    return value;
  }

  const defaults = freeze({
    version:1,
    sports:{
      Course:{pointsPerMeter:1, referenceSpeedKmh:10},
      Marche:{pointsPerMeter:2, referenceSpeedKmh:5},
      'Vélo':{pointsPerMeter:0.5, referenceSpeedKmh:20}
    },
    bonusTiers:[
      {maxRatio:1, bonusPct:0},
      {maxRatio:1.5, bonusPct:2},
      {maxRatio:2, bonusPct:5},
      {maxRatio:null, bonusPct:10}
    ],
    maxBonusPct:10,
    forecast:{
      activeWindowDays:28,
      defaultActivitiesPerWeek:2,
      defaultEnergy:5000,
      priorWeeks:1,
      priorActivities:4,
      minObservationDays:7,
      maxEuroPerEnergy:0.025
    }
  });

  function validateRules(rules) {
    object(rules, 'Les règles');
    const version = number(rules.version, 'La version des règles', {min:1, integer:true});
    const suppliedSports = object(rules.sports, 'Les sports');
    const sports = {};
    for (const sport of SPORTS) {
      if (!own(suppliedSports, sport)) fail('Le barème du sport ' + sport + ' est manquant.');
      const rule = object(suppliedSports[sport], 'Le barème ' + sport);
      sports[sport] = {
        pointsPerMeter:positive(rule.pointsPerMeter, 'Le coefficient ' + sport),
        referenceSpeedKmh:positive(rule.referenceSpeedKmh, 'La vitesse de référence ' + sport)
      };
    }
    const maxBonusPct = number(rules.maxBonusPct, 'Le plafond du bonus', {max:10});
    if (!Array.isArray(rules.bonusTiers) || !rules.bonusTiers.length || rules.bonusTiers.length > 20) {
      fail('Définissez entre un et vingt paliers de bonus.');
    }
    let previousRatio = 0, previousBonus = -1;
    const bonusTiers = rules.bonusTiers.map((item, index) => {
      object(item, 'Le palier de bonus');
      const last = index === rules.bonusTiers.length - 1;
      const maxRatio = last ? null : positive(item.maxRatio, 'Le seuil du bonus');
      if ((last && item.maxRatio !== null) || (!last && maxRatio <= previousRatio)) {
        fail('Les seuils de bonus doivent croître ; le dernier seuil doit être null.');
      }
      const bonusPct = number(item.bonusPct, 'Le pourcentage du bonus', {max:10});
      if (bonusPct < previousBonus) fail('Les bonus doivent être croissants ou égaux.');
      previousRatio = maxRatio;
      previousBonus = bonusPct;
      return {maxRatio, bonusPct};
    });
    const source = object(rules.forecast, 'Les paramètres de prévision');
    const forecast = {
      activeWindowDays:number(source.activeWindowDays, 'La fenêtre des participants actifs', {min:1, max:366, integer:true}),
      defaultActivitiesPerWeek:positive(source.defaultActivitiesPerWeek, 'La fréquence initiale'),
      defaultEnergy:positive(source.defaultEnergy, 'L’énergie moyenne initiale'),
      priorWeeks:number(source.priorWeeks, 'Le poids initial de fréquence'),
      priorActivities:number(source.priorActivities, 'Le poids initial d’énergie'),
      minObservationDays:positive(source.minObservationDays, 'La durée minimale d’observation'),
      maxEuroPerEnergy:positive(source.maxEuroPerEnergy, 'Le plafond de conversion')
    };
    if (forecast.minObservationDays > forecast.activeWindowDays) fail('La durée minimale d’observation dépasse la fenêtre des participants actifs.');
    return {version, sports, bonusTiers, maxBonusPct, forecast};
  }

  function calculate(input, rules = defaults) {
    object(input, 'L’activité');
    const valid = validateRules(rules);
    const sport = input.sport;
    if (!SPORTS.includes(sport)) fail('Choisissez Course, Marche ou Vélo.');
    const distanceMeters = positive(input.distanceMeters, 'La distance');
    const durationSeconds = positive(input.durationSeconds, 'La durée');
    const settings = valid.sports[sport];
    const speedKmh = safe(distanceMeters / durationSeconds * 3.6, 'La vitesse');
    const speedRatio = safe(speedKmh / settings.referenceSpeedKmh, 'Le rapport de vitesse');
    // Deux unités de précision flottante absorbent les erreurs de division aux
    // frontières exactes, sans arrondir les vitesses à un nombre de décimales.
    const tier = valid.bonusTiers.find(item => item.maxRatio === null || speedRatio <= item.maxRatio ||
      speedRatio - item.maxRatio <= Number.EPSILON * Math.max(1, speedRatio, item.maxRatio) * 2);
    const bonusPct = Math.min(valid.maxBonusPct, tier.bonusPct);
    const baseEnergy = safe(distanceMeters * settings.pointsPerMeter, 'L’énergie de base');
    const energy = Math.round(safe(baseEnergy * (1 + bonusPct / 100), 'L’énergie'));
    return {energy, baseEnergy, bonusPct, speedKmh, sport, distanceMeters, durationSeconds};
  }

  function forecast(input, rules = defaults) {
    object(input, 'La prévision');
    const settings = validateRules(rules).forecast;
    const budgetCents = number(input.budgetCents, 'Le budget en centimes', {integer:true});
    const raisedCents = number(input.raisedCents, 'La collecte en centimes', {integer:true});
    if (raisedCents > budgetCents) fail('La collecte ne peut pas dépasser le budget.');
    const activeParticipants = number(input.activeParticipants, 'Les participants actifs', {integer:true});
    const activityCount = number(input.activityCount, 'Le nombre d’activités', {integer:true});
    const totalEnergy = number(input.totalEnergy, 'L’énergie observée');
    const observationDays = number(input.observationDays, 'La durée d’observation');
    const remainingDays = number(input.remainingDays, 'La durée restante');
    const days = Math.min(settings.activeWindowDays, Math.max(settings.minObservationDays, observationDays));
    const hasObservations = activeParticipants > 0 && activityCount > 0;
    let frequencyPerWeek = settings.defaultActivitiesPerWeek;
    let averageEnergy = settings.defaultEnergy;
    if (hasObservations) {
      const priorFrequency = safe(activeParticipants * settings.defaultActivitiesPerWeek * settings.priorWeeks, 'Le lissage de fréquence');
      const numerator = safe(activityCount + priorFrequency, 'La fréquence cumulée');
      const denominator = safe(activeParticipants * (days / 7 + settings.priorWeeks), 'La durée cumulée d’observation');
      frequencyPerWeek = safe(numerator / denominator, 'La fréquence hebdomadaire');
      const energyNumerator = safe(totalEnergy + settings.priorActivities * settings.defaultEnergy, 'L’énergie lissée');
      const energyDenominator = safe(activityCount + settings.priorActivities, 'Le nombre lissé d’activités');
      averageEnergy = safe(energyNumerator / energyDenominator, 'L’énergie moyenne');
    }
    const expectedEnergy = safe(Math.max(1, activeParticipants) * frequencyPerWeek * averageEnergy * (remainingDays / 7), 'L’énergie prévisionnelle');
    const remainingEuros = (budgetCents - raisedCents) / 100;
    const ratioEuroPerEnergy = remainingDays === 0 || remainingEuros === 0 ? 0 :
      Math.min(settings.maxEuroPerEnergy, remainingEuros / Math.max(settings.defaultEnergy, expectedEnergy));
    return {
      ratioEuroPerEnergy,
      expectedEnergy,
      frequencyPerWeek,
      averageEnergy,
      activeParticipants,
      provisional:!hasObservations || observationDays < settings.minObservationDays
    };
  }

  function timestamp(value, label) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parsed = Date.parse(value + 'T00:00:00.000Z');
      if (Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value) return parsed;
    } else if (typeof value === 'number' && Number.isSafeInteger(value) && Number.isFinite(new Date(value).getTime())) {
      return value;
    }
    fail(label + ' doit être une date YYYY-MM-DD valide ou un timestamp en millisecondes.');
  }

  function campaignEnd(startAt, period) {
    const months = {monthly:1, quarterly:3, yearly:12};
    if (!own(months, period)) fail('Choisissez une période monthly, quarterly ou yearly.');
    const start = new Date(timestamp(startAt, 'Le début de campagne'));
    const day = start.getUTCDate();
    const end = new Date(start.getTime());
    end.setUTCDate(1);
    end.setUTCMonth(end.getUTCMonth() + months[period]);
    const last = new Date(end.getTime());
    last.setUTCMonth(last.getUTCMonth() + 1, 0);
    end.setUTCDate(Math.min(day, last.getUTCDate()));
    if (!Number.isFinite(end.getTime())) fail('La fin de campagne dépasse les dates autorisées.');
    return end.getTime();
  }

  function endingSoon(startAt, endAt, now) {
    const start = timestamp(startAt, 'Le début de campagne');
    const end = timestamp(endAt, 'La fin de campagne');
    const instant = timestamp(now, 'La date courante');
    if (end <= start) fail('La fin de campagne doit suivre son début.');
    return instant >= start && instant >= end - 15 * DAY && instant < end;
  }

  // Une seule forme, sans argument de personnalisation. La couleur suit le contexte CSS.
  const icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" focusable="false"><path d="M13.8 2.1c.4 3.9-2.5 5.2-2.5 8.1 0 1.2.6 2.1 1.5 2.6-.1-2.1 1.8-3.1 2.4-4.8 3.3 2.7 4.8 5.3 4.8 8a8 8 0 0 1-16 0c0-4.7 3.8-6.9 4.3-10.2.8 1 1.3 2.1 1.4 3.2 1.6-2.2 1.9-4.5 1.4-7.1 1 .6 1.9.7 2.7.2Z"/></svg>';

  return Object.freeze({defaults, validateRules, calculate, forecast, campaignEnd, endingSoon, icon});
});

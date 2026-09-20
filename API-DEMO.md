# API locale — Demo, Energy et Platform

Ces modules appartiennent à la maquette. Ils n’effectuent aucune requête métier distante, n’envoient pas d’e-mail et ne réalisent aucun paiement. Les contrôles de rôle et de confidentialité s’exécutent dans le navigateur.

## Chargement et persistance

    <script src="demo-store.js"></script>
    <script src="energy.js"></script>
    <script src="platform-store.js"></script>
    <!-- Puis app.js, stories.js et demo-shell.js, ou admin.js. -->

| Module | Global / stockage | Responsabilité |
|---|---|---|
| demo-store.js | Demo ; moovon:demo:v1 | Identités, entreprises, invitations, stories, horloge |
| energy.js | Energy ; aucun stockage | Calcul d’énergie, prévision et dates ; export CommonJS également |
| platform-store.js | Platform ; moovon:platform:v1 | Catalogue, campagnes, activités/contributions, événements et statistiques |

La session utilise **sessionStorage['moovon:demo:session:v1']**. Les données métier utilisent localStorage : application et CRM partagent les données uniquement sur la même origine, dans le même navigateur. La session peut différer d’un onglet à l’autre.

Les objets renvoyés sont des copies, sauf les constantes Energy.defaults et Energy.icon, exposées en lecture seule. Les mutations sérialisent l’état avant de notifier ; une erreur de quota lève une erreur en français et préserve l’enregistrement précédent. Ce mécanisme local ne fournit pas de garantie de concurrence entre plusieurs appareils ou écritures simultanées de plusieurs onglets.

**Demo.onChange(fn)** et **Platform.onChange(fn)** renvoient une fonction de désinscription ; leurs notifications ont la forme {type}. Elles couvrent les changements locaux et les événements storage des autres onglets. L’interface doit réagir à une modification d’identité et interrompre ses parcours si la session disparaît.

## Energy : règles et calculs purs

Energy.defaults est un objet JSON clonable, profondément gelé. Pour éditer des règles :

    const rules = JSON.parse(JSON.stringify(Energy.defaults));
    rules.sports.Marche.pointsPerMeter = 2;
    const validated = Energy.validateRules(rules);

**Energy.validateRules(rules)** renvoie une copie normalisée ou lève une erreur. version est un entier positif identifiant le barème ; les versions ultérieures à 1 sont acceptées. Les paramètres initiaux sont des hypothèses de présentation, pas une validation physiologique.

    {
      version: 1,
      sports: {
        Course: { pointsPerMeter: 1, referenceSpeedKmh: 10 },
        Marche: { pointsPerMeter: 2, referenceSpeedKmh: 5 },
        'Vélo': { pointsPerMeter: 0.5, referenceSpeedKmh: 20 }
      },
      bonusTiers: [
        { maxRatio: 1, bonusPct: 0 },
        { maxRatio: 1.5, bonusPct: 2 },
        { maxRatio: 2, bonusPct: 5 },
        { maxRatio: null, bonusPct: 10 }
      ],
      maxBonusPct: 10,
      forecast: {
        activeWindowDays: 28,
        defaultActivitiesPerWeek: 2,
        defaultEnergy: 5000,
        priorWeeks: 1,
        priorActivities: 4,
        minObservationDays: 7,
        maxEuroPerEnergy: 0.025
      }
    }

**Energy.calculate({sport,distanceMeters,durationSeconds}, rules = Energy.defaults)** renvoie {energy,baseEnergy,bonusPct,speedKmh,sport,distanceMeters,durationSeconds}. Les sports admis sont exactement Course, Marche, Vélo ; distance et durée doivent être des nombres positifs et finis. Le module refuse les calculs dépassant la précision numérique autorisée.

    vitesse = distanceMeters / durationSeconds × 3,6
    rapport = vitesse / vitesseDeRéférence
    baseEnergy = distanceMeters × pointsPerMeter
    energy = arrondi(baseEnergy × (1 + bonusPct / 100))

Les bornes de palier sont inclusives. Le bonus ne peut dépasser 10 %. baseEnergy peut être fractionnaire ; l’arrondi intervient sur l’énergie finale. Exemple course : **5000 m / 1800 s → 5000** ; **5000 m / 1200 s → 5100**. La durée intervient par la vitesse, sans multiplication additionnelle distance × temps.

**Energy.forecast({budgetCents,raisedCents,activeParticipants,activityCount,totalEnergy,observationDays,remainingDays}, rules)** renvoie :

    {
      ratioEuroPerEnergy, expectedEnergy, frequencyPerWeek,
      averageEnergy, activeParticipants, provisional
    }

Les montants d’entrée sont des entiers en centimes, avec 0 <= raisedCents <= budgetCents. Les autres données doivent être non négatives ; participants et nombre d’activités sont entiers. La prévision n’écrit aucun historique et ne crée aucune contribution.

La couche appelante sélectionne les participants ayant une activité admissible dans la campagne sur la fenêtre de 28 jours, ainsi que les activités correspondantes. Dans Platform, les comptes suspendus, les comptes plateforme et les activités migrées sans durée sont exclus de cette observation.

Avec des observations, le lissage est :

    jours = min(fenêtreActive, max(duréeMinimale, observationDays))
    fréquence = (activityCount + actifs × fréquenceInitiale × priorWeeks)
                / (actifs × (jours/7 + priorWeeks))
    énergieMoyenne = (totalEnergy + priorActivities × énergieInitiale)
                     / (activityCount + priorActivities)
    énergiePrévue = max(1, actifs) × fréquence × énergieMoyenne × remainingDays/7
    ratio = min(plafond, budgetRestantEuros / max(énergieInitiale, énergiePrévue))

Sans participant ou sans activité, la fréquence et l’énergie moyenne initiales sont utilisées. Le nombre réel affichable reste activeParticipants: 0 quand il est nul ; le minimum de 1 ne sert qu’au calcul. provisional vaut aussi vrai avant la durée minimale d’observation. Budget épuisé ou durée restante nulle : ratio zéro.

**Energy.campaignEnd(startAt, period)** accepte une date stricte YYYY-MM-DD ou un timestamp en millisecondes. Les périodes sont monthly, quarterly, yearly : ajout de 1, 3 ou 12 mois en UTC, avec jour ramené au dernier jour du mois cible si nécessaire. Retour : timestamp de fin exclusive.

**Energy.endingSoon(startAt,endAt,now)** est vrai uniquement si la campagne a commencé et endAt - 15 jours <= now < endAt. Ce calcul ne porte pas sur un bilan glissant.

**Energy.icon** est la chaîne SVG constante de la flamme, sans paramètre de forme ; sa couleur suit currentColor.

## Demo : entreprises et comptes

- **Demo.current()** → {org,user} ou null ; **Demo.logout()** déconnecte l’onglet.
- **Demo.orgs()** et **Demo.org(id)** : disponibles avant connexion pour choisir et afficher l’entreprise ; org(id) renvoie null si inconnue.
- **Demo.login({email,orgId})** → {org,user} : compte local actif de l’entreprise, ou opérateur plateforme. Les comptes inconnus, invités ou suspendus sont refusés. Le code 123456 appartient au parcours d’interface, pas à une authentification serveur.
- **Demo.users(orgId)** : comptes de l’entreprise courante ; la plateforme peut consulter une autre entreprise.
- **Demo.directory()** : personnes actives des entreprises de la démo, hors compte plateforme, pour les événements interentreprises. Session requise ; champs limités à id,name,orgId,team,orgName.
- **Demo.canAdmin()** : session active de rôle admin ou platform.
- **Demo.createOrg({name,shortName,domain,color,accent,program,adminName,adminEmail,teams})** : plateforme uniquement ; renvoie {org,user} avec premier administrateur actif. Domaine unique ; équipes par défaut ['Direction','Équipes']. Aucun e-mail envoyé, session de l’opérateur conservée.
- **Demo.updateOrg(id,patch)** : administrateur de l’entreprise ou plateforme ; identité, domaine et équipes. Une équipe utilisée ne peut être retirée. Le champ historique monthlyGoal reste accepté pour compatibilité, mais le budget de campagne est géré par Platform.
- **Demo.updateProfile({name,team})** : modification de son profil, sans changement de rôle ou d’entreprise.
- **Demo.setUserStatus(userId,'active'|'suspended')** : administrateur du même espace ou plateforme ; interdit sur soi et sur le compte plateforme. Suspendre un invité révoque son invitation ; un invité doit accepter son lien avant activation.

Les comptes fictifs sont listés dans [README.md](README.md).

## Demo : invitations, horloge et remise à zéro

**Demo.invite(orgId,{name,email,team,role})** est réservé à l’administration ; rôle employee ou admin. Retour {user,invite} : compte invited, invitation pending, validité sept jours sur l’horloge de la démo. Aucun envoi d’e-mail.

- **Demo.getInvitation(token)** → aperçu {orgId,orgName,name,email,status,expiresAt} ou null. Peut afficher le statut calculé expired.
- **Demo.acceptInvite(token)** → compte activé une seule fois ; le shell appelle ensuite Demo.login({email:user.email,orgId:user.orgId}).
- **Demo.invitations(orgId)** : liste réservée à l’administration. Les invitations portent id,orgId,userId,email,token,createdAt,expiresAt,status.
- **Demo.now()** : heure réelle augmentée du décalage de démo.
- **Demo.advanceHours(n)** : avance de 0 à 8 760 heures, session requise ; concerne tous les espaces de ce navigateur.
- **Demo.reset()** : reseed des identités/stories, déconnexion, retrait de moovon:platform:v1, des anciennes clés moovon:app:v2: et des rappels moovon:campaign-notice:. Les autres données et le cache statique ne sont pas effacés. L’interface expose cette opération dans les outils d’administration.

## Demo : stories de 24 heures et confidentialité

**Demo.getStories(orgId, {includeExpired:false})** renvoie les stories actives, de la plus récente à la plus ancienne. Paramètres facultatifs. includeExpired:true requiert un administrateur ; les stories retirées restent exclues. L’expiration dépend de expiresAt, pas d’un changement de statut stocké.

**Demo.createStory({type:'text'|'photo',text,media,bg,activity})** déduit auteur et entreprise de la session. Texte limité à 1 000 caractères ; fond #RRGGBB ; media est une dataURL PNG/JPEG/WebP/GIF, maximum 1 200 000 caractères. Texte requis pour une story texte, média requis pour une photo. Expiration exactement 24 heures après publication.

L’instantané facultatif activity contient :

    {
      phase: 'before', // ou 'during', 'after'
      sport: 'Course', activityId: '',
      distanceMeters: 0, durationSeconds: 0, energy: 0, speedKmh: 0,
      hideRoute: true, route: ''
    }

Avant l’activité, les statistiques sont forcées à zéro. Le trajet est un dessin de démonstration. La story ne crée aucune activité ni contribution. À la lecture, une story liée à une activité dont le trajet a été masqué masque également son trajet.

- **Demo.setStoryPrivacy(id,hideRoute)** : auteur uniquement, story contenant un instantané d’activité ; ne modifie pas les statistiques.
- **Demo.deleteStory(id)** : auteur ou administrateur de l’espace ; retrait, libération de l’image locale et clôture des signalements associés.
- **Demo.markStorySeen(id)** et **Demo.hasSeenStory(id)** : état propre à la personne ; erreur si la story est expirée ou retirée.
- **Demo.reportStory(id,reason)** : motif requis, un signalement ouvert par personne/story.
- **Demo.reports(orgId)** et **Demo.dismissReport(id)** : administration.
- **Demo.stats(orgId)** : nombres users,activeUsers,invitedUsers,suspendedUsers,activeStories,expiredStories,openReports ; administration uniquement.

L’expiration retire la visibilité locale ; elle ne garantit pas la purge sécurisée des fichiers.

## Platform : catalogue et règles

- **Platform.catalog()** → {associations,missions}, session requise ; catalogue commun aux entreprises.
- **Platform.rules()** → copie des règles courantes ; **Platform.updateRules(rules)** : plateforme uniquement, validation par Energy et incrément de la version avant sauvegarde. Aucune recalculation historique.
- **Platform.saveAssociation({id?,name,logo,description,website,contact})** : plateforme ; création ou modification. Logo local PNG/JPEG/WebP ; site HTTP(S).
- **Platform.saveMission({id?,associationId,name,description,unit,unitCostEuros,goalEuros})** : plateforme. Persistance en unitCostCents et goalCents. Une mission déjà utilisée ne peut changer d’association.
- **Platform.missionStats(id)** → {goalCents,raisedCents,targetImpact,financedImpact} : agrégats de la mission à travers les campagnes. Les unités financées sont calculées selon le coût figé dans chaque campagne.

Associations et données initiales sont fictives : Canopée Solidaire et Table Ouverte ; arbres à 5 €, repas à 8 €, kits scolaires à 15 €. Ces prix sont des exemples, pas des engagements de versement.

## Platform : campagnes et registre monétaire

**Platform.createCampaign({orgId?,associationId,missionId,budgetEuros,period,startDate,replaceActive?})** requiert l’administrateur de l’entreprise ou la plateforme. Les périodes sont celles d’Energy.campaignEnd. La campagne copie le nom, l’unité et le coût unitaire de la mission afin de préserver l’impact historique.

Un chevauchement nécessite replaceActive:true. Un remplacement immédiat clôt la campagne précédente sans retirer ses activités. Pour un début futur, la campagne actuelle contribue jusqu’à ce début ; sa fin initiale est conservée dans originalEndAt. Une campagne terminée ne peut être créée.

- **Platform.campaigns(orgId?)** : historique de l’entreprise autorisée.
- **Platform.activeCampaign(orgId?)** : campagne active à Demo.now() ou null.
- **Platform.campaignStats(id)** : {campaign,mission,association,activeParticipants,activityCount,totalEnergy,raisedCents,budgetCents,remainingCents,progressPct,targetImpact,financedImpact,forecast,remainingDays,energyRequired,endingSoon}.

targetImpact = partieEntière(budgetCents / coûtUnitaireFigé) ; financedImpact = partieEntière(raisedCents / coûtUnitaireFigé). Le budget de l’entreprise est distinct de l’objectif global de la mission.

    const saved = Platform.recordActivity({
      id: 'identifiant-stable-de-cette-soumission', // facultatif
      sport: 'Course', distanceMeters: 5000, durationSeconds: 1800,
      title: 'La sortie du midi', publish: true, hideRoute: true, route: ''
    });

L’activité enregistrée contient le résultat d’Energy.calculate, id,userId,orgId,name,team,title,at,published,hideRoute,route, puis campaignId,contributionCents,ratioEuroPerEnergy,rulesVersion. Auteur, entreprise, heure et campagne sont déterminés par la session.

La nouvelle activité participe au calcul des actifs avant fixation de sa contribution :

    contributionCentimes = min(resteCentimes, max(0, arrondi(énergie × ratio × 100)))

L’activité et sa contribution sont sauvegardées ensemble dans l’état local. Le même identifiant soumis à nouveau par son auteur renvoie l’activité existante sans double crédit. Un identifiant appartenant à une autre personne ou entreprise est refusé. Sans campagne active, ou budget épuisé, la contribution vaut zéro mais l’activité reste enregistrée.

Les contributions en centimes constituent le registre stable. Modifier les paramètres, le coût catalogue ou la confidentialité ne réécrit pas les écritures acquises. Les champs demo:true marquent les activités fictives initiales ; legacy:true marque les activités conservées depuis l’ancienne maquette, sans nouvelle contribution rétroactive.

## Platform : fil, confidentialité et profil

- **Platform.activities(orgId?)** : ses activités ; l’administration peut consulter celles de son entreprise. Les trajets privés d’autres auteurs ne sont pas retournés.
- **Platform.feed()** : publications de l’entreprise courante uniquement.
- **Platform.activityPrivacy(id)** : état hideRoute dans l’entreprise courante ou null.
- **Platform.storySnapshot(id)** : copie complète d’une activité de l’auteur connecté, ou null. Le trajet reste disponible dans cet instantané réservé à l’auteur pour préparer une story et permettre un changement ultérieur de confidentialité ; son rendu respecte hideRoute. Ne pas utiliser cette méthode pour construire le fil d’autres personnes.
- **Platform.setActivityPrivacy(id,hideRoute)** : auteur de l’activité uniquement ; le masquage ne change pas le registre.
- **Platform.likes(id)** et **Platform.toggleLike(id)** → {count,liked} ; publication accessible requise.
- **Platform.comments(id)** : commentaires de la publication ; **Platform.comment(id,text)** ajoute un commentaire, 400 caractères maximum.
- **Platform.profileStats({weekOffset:0})** : semaine courante ; offsets négatifs autorisés jusqu’à -520. Retour : weekStart,weekEnd,distanceMeters,energy,previousDistanceMeters,evolutionPct,weeklyAverageMeters,totalDistanceMeters,totalEnergy,days,activities. Les jours sont des agrégats de mètres et d’énergie. evolutionPct vaut null sans distance la semaine précédente.

Les semaines sont calculées en UTC, du lundi au dimanche. La moyenne hebdomadaire utilise les semaines écoulées depuis la première activité, avec au moins une semaine. Une activité non publiée compte dans le profil et la campagne, mais n’entre pas dans le fil.

## Platform : événements

**Platform.directory()** reprend l’annuaire actif limité de Demo.directory().

**Platform.createEvent({name,description,startPoint,endPoint,date,time,distanceMeters,capacity,visibility,invitedUserIds})** crée un événement futur ; date YYYY-MM-DD, heure HH:mm, interprétées dans le fuseau local du navigateur. capacity peut être null/vide ou un entier positif ; l’organisateur occupe une place et reste inscrit.

- visibility:'company' : entreprise de l’organisateur.
- visibility:'public' : membres connectés de toutes les entreprises de la démonstration.
- visibility:'private' : organisateur et personnes explicitement invitées, éventuellement d’autres entreprises.
- **Platform.events()** : événements visibles par la session, triés par date.
- **Platform.joinEvent(id)** : contrôle visibilité, date future et places disponibles ; pas de double inscription.
- **Platform.leaveEvent(id)** : désinscription, sauf organisateur.

## Vérification

    node --test tests/*.test.cjs

Les tests utilisent les modules réels et des contextes VM avec stockage simulé : calculs, bornes, dates, permissions, confidentialité, registre, invitations, quota et expiration. Ils ne prouvent ni un comportement navigateur complet ni une publication distante ; ces vérifications sont décrites dans [PRESENTATION.md](PRESENTATION.md) et [DEPLOIEMENT.md](DEPLOIEMENT.md).

# Moov’On — maquette salarié et CRM

Moov’On relie les activités des salariés à une campagne solidaire financée par leur entreprise. Course, marche et vélo produisent une énergie calculée à partir des mètres parcourus et d’un bonus de vitesse limité. Chaque activité enregistrée contribue automatiquement à la campagne en cours, dans la limite de son budget.

Cette version est une **maquette statique avec données locales** : comptes, entreprises, associations, activités et montants de départ sont fictifs. Les euros affichés représentent une simulation de financement ; aucun paiement ni versement n’est réalisé. La course et les trajets sont simulés, sans GPS réel.

## Démarrer

Depuis le dossier du dépôt, avec Python installé :

    python -m http.server 8765

Ouvrir [l’application salarié](http://localhost:8765/index.html) et [le portail/CRM](http://localhost:8765/admin.html) dans le même navigateur. Le site ne demande aucune installation de dépendances. Node.js sert aux tests et à la préparation des fichiers d’hébergement.

L’application et le portail utilisent **la même origine** : protocole, hôte et port identiques. localhost, 127.0.0.1, un autre port ou un autre appareil ont chacun leurs données. Éviter l’ouverture directe en file://. La session étant propre à l’onglet, le portail peut demander une nouvelle connexion.

Le guide [PRESENTATION.md](PRESENTATION.md) décrit un parcours guidé ; [API-DEMO.md](API-DEMO.md) décrit les modules ; [DEPLOIEMENT.md](DEPLOIEMENT.md) décrit la cible Vercel et les contrôles avant publication.

## Comptes de présentation

| Profil | Entreprise | Adresse | Rôle |
|---|---|---|---|
| Camille Roux | Banque Corélis | camille@corelis.fr | Salariée |
| Léa Fontaine | Banque Corélis | lea@corelis.fr | Administratrice entreprise |
| Sofiane B. | Banque Corélis | sofiane@corelis.fr | Salarié |
| Alex Morgan | Nova Conseil | alex@nova-conseil.fr | Salarié |
| Sarah Benali | Nova Conseil | sarah@nova-conseil.fr | Administratrice entreprise |
| Équipe Moov’On | Sélecteur d’entreprises | hello@moovon.demo | Opérateur plateforme |

Choisir l’entreprise, saisir l’adresse, puis **Continuer par e-mail** et le code **123456**. Aucun message n’est envoyé. **Se connecter avec mon entreprise** illustre également une connexion simulée. **Outils de présentation** permet de changer de profil.

## Parcours et responsabilités

| Espace | Fonctions |
|---|---|
| Salarié | Démarrage d’une course, marche ou sortie vélo simulée, avec calcul automatique des mètres, de la durée et de l’énergie ; fil, encouragements et commentaires ; stories ; événements ; impact de la campagne ; profil hebdomadaire |
| Entreprise | Choix de l’association, de la mission, du budget et de la période ; suivi des contributions ; identité visuelle ; équipes, invitations et accès ; modération |
| CRM Moov’On | Catalogue des associations et missions, coûts unitaires et objectifs en euros ; règles d’énergie et de conversion ; création et administration des entreprises |

L’entreprise choisit sa campagne. Les coefficients sportifs et les paramètres de conversion sont administrés par la plateforme. L’énergie est un compteur d’activité : la contribution est enregistrée automatiquement, sans étape d’affectation par le salarié.

Dans l’application, **Commencer une activité** permet de choisir le sport puis de démarrer la simulation. **Terminer** ouvre le résumé ; le salarié peut enregistrer avec ou sans publication dans le fil, et partager une story avant, pendant ou après sa sortie.

Les périodes disponibles sont mensuelle, trimestrielle et annuelle. Une nouvelle campagne conserve l’historique des précédentes. Lorsqu’un remplacement est programmé dans le futur, la campagne courante contribue jusqu’au nouveau début ; ses écritures passées restent conservées.

## Règles proposées dans cette maquette

Ces valeurs sont des **hypothèses de présentation ajustables dans le CRM**, à valider avec le client. Elles ne constituent pas une mesure physiologique.

    vitesse km/h = mètres / secondes × 3,6
    énergie = arrondi(mètres × coefficientSport × (1 + bonus / 100))

| Sport | Coefficient initial | Vitesse de référence |
|---|---:|---:|
| Course | 1 point/mètre | 10 km/h |
| Marche | 2 points/mètre | 5 km/h |
| Vélo | 0,5 point/mètre | 20 km/h |

Le bonus dépend du rapport vitesse/vitesse de référence : jusqu’à 1 → 0 % ; au-delà jusqu’à 1,5 → 2 % ; au-delà jusqu’à 2 → 5 % ; au-delà → 10 %. Le bonus total est plafonné à 10 %. **Une course de 5 000 mètres en 30 minutes produit 5 000 points ; en 20 minutes, 5 100 points.** La durée sert à calculer la vitesse ; elle ne multiplie pas une seconde fois la distance.

La conversion en euros utilise le budget restant, les participants ayant une activité dans la campagne au cours des **28 derniers jours**, la fréquence d’activité, l’énergie moyenne et le temps restant. Les comptes inscrits sans activité ne comptent pas comme participants. Sans historique, le calcul utilise une hypothèse de 1 participant, 2 activités/semaine et 5 000 points/activité ; le nombre de participants affiché reste zéro. Le plafond initial est de **0,025 €/point**, également proposé et configurable.

Chaque contribution est **figée en centimes** avec le ratio et la version des règles appliqués. Une modification ultérieure du ratio ne revalorise pas l’historique. Le contrôle d’enregistrement limite la contribution au budget restant. Les montants acquis ne diminuent pas lorsque de nouveaux participants font évoluer le ratio.

L’impact distingue l’objectif de la mission, la cible financée par l’enveloppe de l’entreprise et les unités financées dans la simulation. Le catalogue initial illustre des arbres à 5 €, des repas à 8 € et des kits scolaires à 15 €. Le coût unitaire est conservé dans la campagne pour préserver son historique.

## Partage, événements et profil

- **Activité privée ou publiée** : les deux contribuent à la campagne. Une activité privée reste hors du fil. L’auteur peut masquer son trajet tout en conservant les statistiques affichables ; les cartes montrent un tracé fictif.
- **Stories de 24 heures** : texte ou photo, avant/pendant/après l’activité ; les statistiques sont un instantané du moment partagé. Publier une story ne crée pas une deuxième activité. L’auteur peut masquer le trajet ; les stories liées respectent également le masquage de l’activité. Suppression et signalement restent disponibles.
- **Événements** : date, heure, départ, arrivée, distance, capacité facultative ; visibilité entreprise, ouverte aux membres des entreprises de la démonstration ou privée sur invitation ; inscription et désinscription.
- **Profil** : distances en mètres, énergie cumulée, graphique journalier, navigation entre semaines et comparaison avec la semaine précédente. Les semaines vont du lundi au dimanche, en UTC. Sans semaine précédente renseignée, aucun pourcentage n’est inventé.
- **Rappel de fin de campagne** : popup uniquement dans les **15 derniers jours avant la fin**, présentant la progression globale de cette campagne. Il ne s’agit pas d’un bilan glissant de quinze jours.

Les contenus de départ sont identifiés comme exemples fictifs. Les nouvelles entreprises commencent sans historique d’activité. Des activités de l’ancienne maquette peuvent être conservées lors de la migration locale ; elles ne reçoivent pas rétroactivement de contribution monétaire.

## Données et remise à zéro

localStorage conserve les identités/stories dans **moovon:demo:v1**, ainsi que les activités, campagnes, événements et catalogue dans **moovon:platform:v1**. sessionStorage conserve la session de chaque onglet. Les interfaces salarié et CRM lisent ces mêmes données sur une origine commune ; aucune synchronisation entre appareils n’est incluse.

Le portail **Présentation** permet d’**Avancer de 24 heures** pour tester les stories et les dates de campagne. Cette action avance uniquement l’horloge de la démo, pour tous ses espaces. **Réinitialiser la démonstration** restaure les entreprises et comptes initiaux, supprime les données métier et les rappels locaux, puis déconnecte l’onglet. Les préférences d’interface et les caches statiques sont distincts.

Une invitation crée un lien activable dans ce navigateur, sans envoi d’e-mail. Les petites images sont stockées localement après préparation par l’interface. Si le quota est atteint, une erreur est affichée ; l’enregistrement précédent est conservé.

Ces contrôles locaux illustrent les rôles et la confidentialité. Ils ne fournissent pas une authentification réelle, une sécurité serveur ou une transaction concurrente entre appareils. L’expiration des stories retire leur visibilité à 24 heures ; elle ne garantit pas une purge sécurisée de leurs médias. Aucun backend, paiement ou application native iOS/Android n’est inclus dans cette évolution.

## Modules

| Fichiers | Rôle |
|---|---|
| demo-store.js | Identité, entreprises, invitations, stories et horloge ; global Demo |
| energy.js | Calculs purs, règles proposées, prévision, dates et flamme ; global Energy et export CommonJS |
| platform-store.js | Catalogue, campagnes, registre des activités/contributions, événements et profil ; global Platform |
| index.html, app.js, app.css | Application salarié |
| stories.js, stories.css | Création et lecture des stories |
| demo-shell.js, demo-shell.css | Connexion et identité entreprise |
| admin.html, admin.js, admin.css | Portail entreprise et CRM plateforme |
| manifest.webmanifest, sw.js, icon.svg | Installation web et cache des fichiers statiques |
| scripts/build-site.cjs, vercel.json | Copie des 16 fichiers publics dans dist/, configuration Vercel |
| tests/ | Tests Node du moteur et des comportements locaux |

Ordre de chargement : **Demo → Energy → Platform → interfaces**. Dans l’application, les interfaces sont app.js, stories.js, puis demo-shell.js ; dans le portail, admin.js.

config.js et supabase/schema.sql sont des archives techniques. La maquette actuelle ne les charge pas, ne charge pas le client Supabase et ne contacte pas cette base. explorations/ conserve des pistes graphiques hors du parcours publié.

## Vérifications et hébergement

    node --test tests/*.test.cjs
    node scripts/build-site.cjs

Le build prépare les fichiers sans publier le site. Les essais navigateur, le contrôle des 16 ressources publiques et la vérification du déploiement sont à effectuer pour chaque version selon [DEPLOIEMENT.md](DEPLOIEMENT.md). Ce document ne constitue pas un compte rendu de recette ou de déploiement.

La cible de publication reste le projet Vercel **moovon-presentation**, branche **codex/client-demo**. L’installation web nécessite localhost ou HTTPS et un navigateur compatible ; elle ne correspond pas à une publication sur les stores. Le service worker cache les ressources statiques de la maquette ; les polices Google sont externes, avec des polices de secours.

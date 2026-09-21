# Présenter Moov’On — salarié, entreprise et CRM

Ce parcours est un **guide à répéter avant la présentation**, pas un compte rendu d’essais navigateur. Prévoir environ dix minutes pour le parcours principal, puis quelques minutes pour les options.

Phrase d’ouverture : « Les activités des salariés font progresser une campagne solidaire financée par leur entreprise. Je vais montrer le parcours salarié, les choix du responsable et le CRM Moov’On. Les comptes, activités, partenaires et montants de cette présentation sont simulés dans ce navigateur. »

## Préparation

1. Démarrer le site depuis le dépôt avec la commande ci-dessous, puis ouvrir [l’application](http://localhost:8765/index.html) et [le portail](http://localhost:8765/admin.html).

       python -m http.server 8765

2. Garder le même navigateur, hôte et port pour les deux espaces. Un nouvel onglet peut demander sa propre connexion : utiliser Léa pour le portail et Camille pour l’application. Ne pas ouvrir le portail sur un autre domaine.
3. Dans le portail, **Présentation** → **Réinitialiser la démonstration**, puis confirmer, si les essais existants peuvent être effacés. Cette action restaure les profils et les données fictives des deux entreprises.
4. Préparer une petite photo JPG/PNG/WebP et, si utile, un logo. Utiliser des contenus de présentation.
5. Répéter les étapes ci-dessous sur la version qui sera montrée. Relever les erreurs éventuelles avant le rendez-vous ; une réussite des tests Node ne remplace pas cette répétition.

Les comptes utilisent le code de démonstration **123456**. Les raccourcis **Outils de présentation** permettent de changer de profil dans l’application ; sur téléphone, ils sont accessibles depuis le bandeau entreprise/compte. Les sessions sont propres à chaque onglet : changer de profil dans l’application ne change pas nécessairement celui du portail.

## 1 · L’entreprise choisit son engagement

Profil : **Léa Fontaine**, lea@corelis.fr. Écran du portail : **Campagnes solidaires**.

1. Choisir **Nouvelle campagne**.
2. Sélectionner **Canopée Solidaire** puis **Planter des arbres**.
3. Saisir **10 000 €**, choisir **Mensuelle · 1 mois** et la date du jour.
4. Montrer le coût d’un arbre, **5 €**, et la cible de **2 000 arbres** rendue possible par ce budget.
5. Si une campagne couvre déjà la période, cocher **Confirmer la succession des campagnes**, puis **Créer la campagne**.
6. Dans **Vue d’ensemble**, montrer la collecte initiale de cette nouvelle campagne et son nombre de participants actifs.

À dire : « L’entreprise choisit la cause, le budget et la durée. Un collaborateur devient participant lorsqu’il enregistre une activité. Le catalogue et les règles de conversion sont gérés par Moov’On. »

L’objectif global de la mission, par exemple 50 000 €, reste distinct de l’enveloppe de cette entreprise. Les 2 000 arbres sont une **cible**, pas un résultat déjà financé. Aucun paiement n’est effectué.

## 2 · Une activité fait progresser automatiquement la campagne

Profil : **Camille Roux**, camille@corelis.fr. Application : **Accueil**, puis bouton **+**.

1. Choisir **Commencer une activité**, sélectionner **Course** et garder **Cacher mon trajet lors du partage** coché. Montrer que **Marche** et **Vélo** sont également disponibles.
2. Choisir **Démarrer l’activité simulée**. Les mètres, la durée, la vitesse et l’énergie évoluent automatiquement. Utiliser **Présentation : avancer de 1 km** pour accélérer le scénario si nécessaire.
3. Appuyer sur **Terminer**, montrer le résumé et son bonus, puis donner un titre à la sortie.
4. Garder le trajet masqué et choisir **Enregistrer et publier dans le fil**. Montrer la nouvelle carte et les statistiques calculées.
5. Ouvrir **Impact** pour montrer la contribution monétaire ajoutée à la campagne.
6. Revenir au portail de Léa : le montant mobilisé, l’énergie et le nombre de participants sont issus de cette même activité.

À dire : « L’enregistrement suffit pour contribuer à la mission choisie par l’entreprise. La conversion s’adapte à son budget et à l’activité du collectif. Le montant de cette activité est ensuite conservé. »

Le résumé présente le bonus calculé selon la vitesse de la simulation. Les coefficients sont des hypothèses réglables, pas une équivalence physiologique. Le montant en euros dépend du ratio du moment : ne pas annoncer une valeur fixe avant l’enregistrement.

Option confidentialité : terminer une seconde activité simulée et choisir **Enregistrer sans publier**. Elle apparaît dans le profil et contribue à la campagne, tout en restant hors du fil collectif.

## 3 · Partager avant, pendant ou après l’activité

Écran : **Les moments du collectif** ou **+** → **Publier une story**.

1. Appuyer sur **Publier une story** : l’appareil photo s’ouvre directement. Autoriser la caméra si le navigateur le demande, puis prendre une photo ; le bouton **Selfie** change de caméra. **Galerie** permet de choisir une photo et **Écrire une story** de passer au texte.
2. Toucher directement un endroit libre de la photo et écrire : le texte apparaît à cet endroit, sans champ sous l’image. Choisir couleur, police, taille, fond et alignement avec les outils sur la photo, puis **Terminer**. Toucher un texte existant pour le corriger ; hors saisie, le glisser pour le déplacer (ou utiliser les flèches du clavier). Le bouton **☺** ajoute un emoji. Jusqu’à six éléments peuvent être modifiés ou supprimés avant publication.
   **Options** permet de modifier la légende, de changer de photo et de vérifier **Cacher mon trajet**. Fermer les options puis **Publier ma story**. Aucune publication n’est effectuée lors de la prise de photo. La disposition des textes et stickers est conservée à la lecture et après rechargement.
3. Pour montrer une story après l’effort, utiliser **Partager en story** depuis une activité du profil, ou depuis le résumé de la sortie. Les statistiques sont reprises automatiquement, sans sélection du moment de la story.
4. Ouvrir la story, puis passer à Léa dans l’application pour la retrouver dans le même espace entreprise.
5. Montrer que la story demeure visible **24 heures** et qu’elle ne crée aucune deuxième contribution.

Pour une story pendant l’effort : **Commencer une activité**, choisir le sport, puis utiliser **Partager ce moment en story** dans la simulation. Les statistiques de la story restent celles de cet instant. Revenir à la simulation, **Terminer**, puis enregistrer le résultat. La simulation est accélérée et n’utilise aucun GPS réel.

À dire : « On peut partager le départ, un moment d’effort ou le résultat, et conserver les chiffres sans montrer son trajet. » Le masquage peut aussi être modifié sur sa propre activité ou story. Une activité masquée impose ce masquage aux stories qui lui sont liées.

## 4 · Un événement rassemble le collectif

Profil : Camille. Écran : **Événements** → **+** ou **Créer un événement**.

1. Créer « La marche de midi » pour une date future, avec une heure, un départ, une arrivée et une distance de **3 000 mètres**.
2. Choisir la visibilité entreprise et une capacité, par exemple **10 participants**, puis enregistrer.
3. Passer à Léa : retrouver l’événement et s’inscrire. Montrer la variation des places disponibles.
4. Expliquer les autres visibilités : **Ouverts à tous** concerne les membres des entreprises de la démonstration ; **Privés** réserve l’événement à l’organisateur et aux personnes invitées.

Le compte de l’organisateur occupe une place. Un événement n’enregistre pas automatiquement une activité sportive pour ses inscrits. Les dates/heures d’événement utilisent le fuseau du navigateur.

## 5 · Le profil suit les mètres et la régularité

Profil : Camille. Écran : **Profil**.

1. Montrer les mètres cumulés et l’énergie récoltée.
2. Parcourir la semaine courante puis la précédente avec les flèches.
3. Toucher un jour du graphique pour consulter les mètres correspondants.
4. Montrer l’évolution par rapport à la semaine précédente et la moyenne hebdomadaire.
5. Retrouver les activités publiques et privées ; vérifier le réglage de confidentialité du trajet.

Les semaines vont du lundi au dimanche, en UTC. Les exemples des profils initiaux sont fictifs. Une nouvelle entreprise sans historique affiche des zéros et aucune évolution en pourcentage lorsqu’il n’existe pas de base de comparaison.

## 6 · Moov’On prépare le catalogue et les règles

Profil : **Équipe Moov’On**, hello@moovon.demo. Écran : portail, rubrique **CRM Moov’On**.

1. Ouvrir **Associations & missions**. Montrer **Nouvelle association**, son logo, sa présentation et son contact.
2. Sous une association, **Ajouter une mission** permet de définir un nom, une unité d’impact, un coût unitaire et un objectif **en euros**.
3. Ouvrir **Conversion & énergie** : coefficients course/marche/vélo, vitesses de référence, bonus plafonné à 10 %, hypothèses initiales et fenêtre des participants actifs de 28 jours. Montrer la comparaison illustrative de **20 ou 200 participants**, avec le même budget de **10 000 €** et **90 jours restants** ; elle n’ajoute aucune activité aux entreprises.
4. Montrer que ces réglages sont absents du menu de Léa : ils appartiennent à la plateforme.
5. Si une modification de règle est montrée, relever d’abord une contribution existante, enregistrer la nouvelle règle, puis vérifier que son montant historique n’a pas changé. Seules les prochaines activités utilisent le nouveau barème.

À dire : « Nous distinguons les paramètres de la plateforme et l’engagement de chaque entreprise. Une modification de règle ne retire pas les euros déjà mobilisés. »

Les prix du catalogue sont des exemples : arbre 5 €, repas 8 €, kit scolaire 15 €. L’impact affiché est une simulation de financement, sans preuve de versement ni de réalisation.

## 7 · Le rappel apparaît à l’approche de la fin

Un petit bandeau apparaît dans l’accueil uniquement **dans les quinze derniers jours avant la fin de la campagne** : jours restants, pourcentage atteint et **Voir le défi**. Il ne bloque pas la navigation. La croix le masque pour la journée et le rappel n’est présenté qu’une fois par jour, profil et campagne. La progression détaillée reste consultable volontairement depuis l’onglet Impact.

1. Dans le portail, relever la date de fin de la campagne.
2. Si nécessaire, utiliser **Présentation** → **Avancer de 24 heures** jusqu’à entrer dans les quinze derniers jours, sans dépasser la fin.
3. Revenir dans l’application et ouvrir l’accueil pour montrer le bandeau. **Voir le défi** mène au défi collectif ; la croix ferme le rappel sans changer d’écran.
4. Vérifier qu’il ne s’agit ni d’un récapitulatif des quinze derniers jours, ni d’un message revenant automatiquement tous les quinze jours.
5. L’avance de l’horloge affecte aussi les stories et événements : faire cette étape après les autres démonstrations.

Si un rappel a déjà été fermé dans ce navigateur, il peut ne plus se présenter à l’identique lors de la répétition. Préparer le scénario avec une nouvelle campagne ou une remise à zéro. À la fin de la campagne, aucune nouvelle activité ne mobilise son budget.

## Options à ajouter selon le rendez-vous

| Sujet | Parcours |
|---|---|
| Identité entreprise | Léa → Identité visuelle → logo, couleurs, nom du programme → Enregistrer → Voir l’application |
| Invitation | Léa → Collaborateurs → Inviter un collaborateur → Créer l’invitation ; ouvrir le lien dans ce même navigateur, puis Accepter l’invitation |
| Modération | Signaler une story d’un autre auteur ; Léa → Stories & modération pour retrouver et traiter le signalement |
| Expiration | Après publication d’une story, Présentation → Avancer de 24 heures ; vérifier qu’elle quitte le flux |
| Deuxième entreprise | Alex ou Sarah chez Nova : identité, fil, stories et campagne propres à cet espace |
| Nouvel espace | Opérateur → Entreprises clientes → Créer une entreprise → Créer l’espace ; premier administrateur actif pour la démonstration |
| Installation web | Installer sur mon téléphone / Installer l’application ; proposition du navigateur ou instructions d’ajout à l’accueil |

Une invitation n’envoie aucun e-mail et ne transporte pas les données sur un autre appareil. Les événements ouverts à tous peuvent traverser les entreprises, contrairement au fil et aux stories de l’entreprise. L’installation web ne correspond pas à une publication App Store ou Google Play.

## Après la répétition

- **Ancien écran** : recharger l’application et le portail ; en cas de fichiers incohérents, vérifier le service worker et supprimer son cache pour cette origine.
- **Chiffres différents entre app et CRM** : vérifier le navigateur, l’origine exacte, l’entreprise sélectionnée et la campagne. Des onglets peuvent avoir des sessions différentes.
- **Photo refusée ou quota atteint** : essayer un petit JPG/PNG/WebP ; ne pas traiter une erreur comme une publication réussie.
- **Story ou événement absent** : vérifier l’entreprise, sa visibilité et l’horloge avancée.
- **Plus de contribution** : vérifier les dates de la campagne active et son budget restant.
- **Téléphone personnel** : utiliser l’URL HTTPS de la version préparée ; localhost désigne le téléphone lui-même. Son navigateur aura son propre jeu de données.

Terminer par **Présentation** → **Réinitialiser la démonstration** si les essais doivent être effacés. Cette opération ne remet pas à zéro le cache statique. Le compte rendu de recette et la vérification du déploiement restent à établir séparément.

## Défis et événements : retrouver la présentation d’origine

Dans l’onglet **Défis**, montrer le défi collectif, le classement hebdomadaire par équipe, le duel et les trois mini-défis. Enregistrer une activité : les mètres de l’équipe et les objectifs individuels progressent automatiquement. Le lien **Voir les événements** descend vers la liste, ses filtres et le bouton de création. La création d’un événement depuis le menu **+** conduit à cette même page.

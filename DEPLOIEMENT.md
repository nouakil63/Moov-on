# Hébergement de la maquette et du CRM

La destination convenue pour cette présentation est **Vercel**, sur le projet et la branche existants. L’application et le portail doivent être publiés ensemble, sur la même origine, pour partager leurs données locales.

| Paramètre | Cible configurée |
|---|---|
| Projet | moovon-presentation |
| Équipe | nouakil63s-projects |
| Dépôt | nouakil63/Moov-on |
| Branche de production | codex/client-demo |
| Application | [moovon-presentation.vercel.app](https://moovon-presentation.vercel.app/) |
| Portail et CRM | [admin.html sur la même origine](https://moovon-presentation.vercel.app/admin.html) |
| Tableau de bord | [Projet Vercel](https://vercel.com/nouakil63s-projects/moovon-presentation) |
| Commande de build | node scripts/build-site.cjs |
| Répertoire publié | dist/ |

Ces adresses identifient la cible existante. **La présence de cette nouvelle version en ligne et sa recette navigateur doivent être vérifiées lors de la publication** ; cette page ne les atteste pas. Le projet Vercel distinct moov-on et la branche main ne sont pas la cible de cette maquette.

## Fichiers publics

vercel.json sélectionne un site statique (framework: null). scripts/build-site.cjs copie explicitement **16 fichiers** :

    index.html               admin.html
    app.css                  app.js
    demo-shell.css           demo-shell.js
    demo-store.js            energy.js
    platform-store.js        stories.css
    stories.js               admin.css
    admin.js                 manifest.webmanifest
    sw.js                    icon.svg

Le build n’embarque ni les tests, ni les documents, ni config.js, ni le schéma Supabase, ni le dépôt Git. Utiliser un répertoire de build propre pour contrôler exactement cette liste. Aucune variable Supabase, clé serveur ou API métier n’est nécessaire au fonctionnement de la maquette.

Les deux pages chargent demo-store.js, puis energy.js, puis platform-store.js, avant leurs interfaces. Les liens vers le portail sont relatifs : ./admin.html. Conserver cette organisation sur une seule origine ; un portail hébergé ailleurs ne verrait pas les données de l’application.

## Préparer et vérifier une version

1. Contrôler la branche courante et les changements destinés à la présentation. Les modifications documentaires ou essais locaux ne déclenchent aucun déploiement à eux seuls.
2. Exécuter les tests et préparer les fichiers :

       node --test tests/*.test.cjs
       node scripts/build-site.cjs

3. Vérifier que dist/ contient les 16 fichiers attendus. Démarrer éventuellement un serveur sur ce répertoire pour vérifier le paquet destiné à Vercel :

       python -m http.server 8765 --directory dist

4. Réaliser le parcours de [PRESENTATION.md](PRESENTATION.md) sur cette origine. Contrôler les deux rôles d’administration, une activité privée/publique, son énergie et sa contribution, les stories et le trajet masqué, les événements et le profil.
5. Vérifier le rappel de campagne uniquement entre endAt - 15 jours inclus et endAt exclu, avec les totaux de la campagne entière. Vérifier aussi une campagne future et une campagne terminée.
6. Publier la révision prévue sur la branche configurée lorsque cette publication est autorisée. La liaison Git Vercel doit viser codex/client-demo ; contrôler le commit effectivement déployé dans le tableau de bord.
7. Après publication, ouvrir l’application et admin.html sur le domaine cible, contrôler l’absence d’erreurs de chargement/console et rejouer les parcours essentiels. Les résultats et le commit vérifiés doivent être consignés dans le compte rendu de livraison.

La préparation des fichiers, un test Node réussi et un lien de projet ne suffisent pas à prouver qu’une version a été publiée ou testée dans un navigateur.

## Cache et données locales

Le service worker met en cache les fichiers statiques de l’application et du CRM. Lors d’une évolution, mettre à jour sa version et les références de ressources concernées, puis contrôler le parcours de mise à jour depuis une visite précédente. Si les fichiers restent incohérents pendant une répétition, désinscrire le service worker et supprimer les caches de cette origine dans les outils du navigateur, puis recharger.

Les comptes/stories et le registre métier sont conservés dans localStorage, séparément du cache statique. Une publication de code n’efface pas ces données. Une nouvelle origine de preview Vercel utilise un autre jeu de données. La session est propre à l’onglet ; un nouvel onglet de portail peut demander une connexion administrateur.

La remise à zéro depuis **Présentation** restaure les données fictives et efface les essais métier, y compris les rappels de campagne. Elle ne purge pas le cache du service worker. Ne pas promettre que les données d’un navigateur sont sauvegardées ailleurs ou accessibles à une autre personne via le lien public.

## Revenir à une version précédente

Si une publication empêche la présentation, choisir dans Vercel une révision précédemment vérifiée pour ce même projet. Contrôler ensuite les ressources réellement servies et le cache du navigateur. Un retour de code ne restaure pas automatiquement l’état de localStorage ; si un schéma local est incompatible, conserver les essais utiles avant de réinitialiser la démonstration.

## Portée de l’hébergement

HTTPS permet d’ouvrir la maquette sur téléphone et d’utiliser les fonctions web disponibles dans le navigateur. L’installation à l’écran d’accueil n’est pas une publication App Store ou Google Play. Les activités, invitations, rôles, contributions et médias restent locaux ; aucun paiement, e-mail ou backend n’est branché par ce déploiement.

Le fichier .openai/hosting.json conserve une trace d’un hébergement antérieur. La cible convenue pour cette évolution demeure Vercel ; ce fichier ne change pas la destination décrite ici.

## Recette locale du 20 septembre 2026

La version maquette/CRM a passé 46 tests Node (identités, règles d’énergie, calendrier, registre monétaire, confidentialité, événements, migration et stockage). La syntaxe des scripts, la préparation des 16 fichiers publics et le contrôle des différences Git passent également.

Les parcours ont été exécutés avec Playwright dans Microsoft Edge, en contextes de test isolés : application à 1 440 et 390 pixels, cadre iPhone sur ordinateur, publication et commentaires, calcul 5 000/5 100, semaines, course simulée, stories avant/pendant/après, trajet masqué, invitations privées et inscription aux événements. Le parcours « story après course avant enregistrement » a été contrôlé avec et sans historique. La remise à zéro permet de revoir le rappel de fin de campagne.

Côté CRM, la recette navigateur couvre la création d’association et mission, le choix filtré par association, un budget de 10 000 € donnant une cible de 2 000 arbres à 5 €, la création de campagne, la séparation entreprise/plateforme et le changement des règles. Une activité d’un autre onglet actualise le suivi ; changer le ratio conserve les euros antérieurs. Aucune erreur JavaScript n’a été relevée pendant ces parcours. Ces essais valident la démonstration locale, sans valider une authentification ou un financement de production.

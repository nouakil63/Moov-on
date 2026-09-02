# Moov'On

Maquette interactive d'une application mobile B2B de sport solidaire : les employés d'une entreprise marchent et courent, chaque mètre parcouru débloque une part du budget mécénat/RSE de l'entreprise, affichée en équivalents concrets (repas financés, arbres plantés).

## Contenu

- `index.html` — maquette autonome (aucun build, aucune dépendance) : ouvrir dans un navigateur ou déployer telle quelle sur Netlify.

## Fonctionnalités de la maquette

- **Accueil** : bandeau d'impact de l'entreprise (budget 100 000 € — données fictives), stories des équipes, fil d'activité social (bravos, commentaires, tracés de parcours).
- **Bouton + central** (codes Instagram/Facebook) : menu dépliant animé — lancer une course, publier un résultat, créer un défi.
- **Course en direct** : GPS simulé, chrono, distance, allure, conversion mètres → repas/arbres/€ en temps réel avec jalons animés, puis écran de résumé et publication dans le fil.
- **Défis** : défi du mois, classement des équipes, duel de la semaine, mini-défis.
- **Impact** : totaux collectifs, barème de conversion, associations soutenues.
- **Profil** : stats personnelles, graphique des pas de la semaine, badges.

Thèmes clair et sombre, animations respectant `prefers-reduced-motion`, état persistant en `localStorage`.

## Barème de conversion (démo)

Défini dans `index.html` (constante `RATE`) : 500 m = 1 repas · 5 km = 1 arbre · 1 000 m = 1,60 €. À terme, configurable par l'entreprise dans un espace administrateur.

Toutes les données (entreprise « Banque Corélis », personnes, associations) sont fictives.

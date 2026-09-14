# Hébergement de la présentation

Le 14 septembre 2026, le propriétaire a demandé explicitement un lien **Vercel**.
Vercel est donc la destination à utiliser pour les prochaines publications de cette maquette.

- Lien public : https://moovon-presentation.vercel.app/
- Projet : `moovon-presentation`, équipe `nouakil63s-projects`.
- Tableau de bord : https://vercel.com/nouakil63s-projects/moovon-presentation
- Dépôt connecté : `nouakil63/Moov-on` ; branche de production : `codex/client-demo`.
- Source de la mise à jour iPhone et publications immédiates : commit `c113be1827f5e89810ac601500b16b893b5f4d33`.
- Déploiement : https://vercel.com/nouakil63s-projects/moovon-presentation/BfaWEiv4NDdW4enPcNSThfLeotvK
- Configuration : `vercel.json` exécute `node scripts/build-site.cjs` et publie uniquement les 14 fichiers statiques de `dist/`.
- La page publique a été vérifiée en HTTP 200 et dans le navigateur avec le cadre iPhone. La première publication avait été réalisée par import ZIP.

Un push sur `codex/client-demo` met désormais ce lien à jour automatiquement. Le projet Vercel distinct `moov-on` conserve sa propre configuration et sa branche de production. Ne pas remplacer `main` pour publier la présentation.

Vérifications de cette version : 24 tests automatiques réussis, publication d’activité avec affichage immédiat dans le fil, commentaire, stories texte et photo ouvrant la nouvelle story, retour à la vignette publiée, affichage mobile sans débordement horizontal. Le cadre iPhone est visible sur ordinateur ; sur téléphone l’application utilise tout l’écran.

Une publication Sites avait été créée auparavant pendant cette même demande. Le fichier `.openai/hosting.json` en conserve l’identifiant, mais la préférence explicite du propriétaire est Vercel. Ne pas choisir Sites par défaut pour les mises à jour.

Les comptes, invitations et contenus restent ceux de la maquette locale : chaque navigateur dispose de ses propres données de démonstration.

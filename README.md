# Moov'On

Maquette interactive d'une application mobile B2B de sport solidaire : chaque mètre parcouru par un employé récolte un point d'énergie (⚡) qu'il distribue ensuite librement aux missions caritatives financées par le budget mécénat/RSE de son entreprise.

## Contenu

- `index.html` — la maquette autonome (aucun build) : accueil, fil d'activité, défis, missions avec dons par curseur, profil, course simulée avec récolte d'énergie en direct, sélecteur de typographie.
- `config.js` — configuration Supabase (vide = mode local via `localStorage`).
- `supabase/schema.sql` — schéma et données de départ pour Supabase.
- `explorations/` — pages comparatives des pistes de design (archives de travail).

## Déployer sur Vercel

Aucune configuration nécessaire — c'est un site statique.

1. Sur [vercel.com/new](https://vercel.com/new), connectez votre compte GitHub si ce n'est pas fait.
2. Importez le dépôt `nouakil63/Moov-on` (choisissez la branche voulue dans les réglages du projet si vous ne déployez pas `main`).
3. Framework preset : **Other** — ne rien changer d'autre. Deploy.

Chaque `git push` redéploie automatiquement.

## Brancher Supabase (optionnel)

Sans Supabase, la maquette fonctionne en local (état dans le navigateur). Avec Supabase, les activités publiées, les dons et les jauges de missions sont partagés entre tous les visiteurs.

1. Créez un projet sur [supabase.com](https://supabase.com) (offre gratuite suffisante).
2. Dans **SQL Editor**, collez le contenu de `supabase/schema.sql` et exécutez (Run). Le script est ré-exécutable sans risque.
3. Dans **Settings → API**, copiez *Project URL* et la clé *anon public* dans `config.js`, puis commitez : Vercel redéploie et la maquette se synchronise.

La clé anon est publique par conception (l'accès est contrôlé par les politiques RLS). **Attention** : les politiques du schéma sont volontairement ouvertes (lecture/écriture anonymes) pour une démo sans authentification — à durcir avant tout usage réel.

## Barème (démo)

1 mètre = 1 ⚡ · les équivalences par mission (500 ⚡ = 1 repas chaud, 5 000 ⚡ = 1 arbre…) sont définies dans la table `missions` et dans `index.html` (`MISSIONS_DEF`). À terme, configurables par l'entreprise dans un espace administrateur.

Toutes les données (entreprise « Banque Corélis », personnes, associations) sont fictives.

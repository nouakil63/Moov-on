# Moov’On — maquette de présentation

Moov’On relie l’activité physique des salariés aux projets solidaires de leur entreprise : **1 mètre parcouru = 1 point d’énergie ⚡**, à répartir entre des missions. Cette version présente le parcours salarié, les stories de 24 heures et le portail entreprise avec deux sociétés fictives.

Le site est statique, sans installation de dépendances ni compilation. Les connexions, rôles, invitations, activités et données d’entreprise sont **simulés dans le navigateur**. Aucun e-mail n’est envoyé et aucune synchronisation entre appareils n’est disponible.

## Démarrer en local

Depuis le dossier du dépôt, avec Python installé :

```powershell
python -m http.server 8765
```

Ouvrir [l’application salarié](http://localhost:8765/index.html). Le [portail entreprise](http://localhost:8765/admin.html) est accessible avec un profil administrateur.

Conserver le même hôte et le même port pendant la démonstration. Éviter l’ouverture directe en `file://` : l’application et le portail ont besoin d’une origine HTTP commune pour partager leurs données locales. `localhost` et `127.0.0.1` constituent aussi deux origines distinctes.

Pour un déroulé client de 5 à 7 minutes, suivre [PRESENTATION.md](PRESENTATION.md).

## Profils de démonstration

| Profil | Entreprise | Adresse | Accès |
|---|---|---|---|
| Camille Roux | Banque Corélis | `camille@corelis.fr` | Salariée |
| Léa Fontaine | Banque Corélis | `lea@corelis.fr` | Administration de Corélis |
| Alex Morgan | Nova Conseil | `alex@nova-conseil.fr` | Salarié |
| Sarah Benali | Nova Conseil | `sarah@nova-conseil.fr` | Administration de Nova |
| Équipe Moov’On | Plateforme | `hello@moovon.demo` | Administration des entreprises |

La page de connexion propose Corélis/Nova et des raccourcis de profils. Pour montrer le parcours complet, saisir une adresse ci-dessus, choisir **Continuer par e-mail**, puis entrer **123456**. Le bouton **Se connecter avec mon entreprise** illustre un parcours SSO ; il ne contacte aucun fournisseur d’identité.

Après connexion, **Outils de présentation** permet de changer de profil. Sur téléphone, ces outils sont aussi accessibles en touchant le nom de l’entreprise en haut de l’application. Le compte Équipe Moov’On figure dans ce sélecteur.

Dans le portail de ce compte plateforme, **Entreprises clientes** → **Créer une entreprise** → **Créer l’espace** crée une société et son premier compte administrateur de démonstration, immédiatement actif. Ce compte peut ensuite se connecter par e-mail avec le code `123456` dans l’espace correspondant.

## Parcours disponibles

- **Application salarié** : accueil personnalisé, fil d’activité, encouragements/commentaires, défis, missions et profil.
- **Activités** : course accélérée avec pause et bouton d’avance de 1 km ; publication ou enregistrement privé avec crédit d’énergie ; ajout d’un résultat manuel.
- **Missions** : choix d’une cause, curseur de don, solde débité et impact mis à jour. Les dons sont des points de démonstration, sans transaction financière.
- **Stories** : texte sur fond coloré ou photo importée, aperçu, lecture, pause, navigation, états vus, suppression de sa story et signalement. Les stories actives sont filtrées par entreprise et expirent 24 heures après leur publication selon l’horloge locale de la démo. La vidéo n’est pas incluse.
- **Portail entreprise** : collaborateurs, invitations locales, personnalisation du nom/programme/logo/couleurs, modération et outils de présentation. Le compte plateforme permet de gérer les entreprises.

Une invitation génère un lien local fonctionnel : il active le compte invité dans ce navigateur. Il peut être collé directement dans le même onglet : l’application ferme la session courante pour afficher l’acceptation de l’invitation. Ce lien ne transporte pas les données vers un autre appareil et ne constitue pas un envoi d’e-mail.

## Données, horloge et remise à zéro

Les données sont conservées dans `localStorage`, par origine du site ; la session de connexion utilise `sessionStorage`, propre à l’onglet. L’application et le portail partagent les données quand ils sont ouverts dans le même navigateur sur la même origine. Un nouvel onglet indépendant peut demander une nouvelle connexion.

Les outils de **Présentation** du portail permettent d’**Avancer de 24 heures** pour montrer l’expiration des stories. Cette avance concerne les données de démonstration, pas l’heure du système. **Réinitialiser la démonstration** restaure les profils et entreprises fictifs, efface les créations/modifications de la démo et déconnecte l’onglet. Les préférences d’interface et le cache du service worker sont distincts de cette remise à zéro.

Les photos sont redimensionnées et compressées en JPEG avant leur enregistrement local. Ce stockage reste limité : utiliser quelques petites images de démonstration et réinitialiser entre les répétitions. Une erreur de quota est affichée et ne doit pas être interprétée comme une publication réussie.

Les contrôles d’accès et l’expiration sont exécutés côté navigateur : **ils ne constituent pas une authentification, une isolation d’entreprises ou une protection de médias utilisables en production**. Les fichiers expirés ne sont pas effacés de façon garantie après 24 heures ; la remise à zéro supprime les données locales de démonstration. Entreprises, personnes et associations de départ sont fictives.

## Limites à annoncer pendant la présentation

| Sujet | Ce que cette version démontre | Ce qui reste à réaliser pour la production |
|---|---|---|
| Connexion et rôles | Parcours e-mail/code, SSO et accès par profil simulés | Authentification réelle, fournisseur d’identité, permissions serveur |
| Invitations | Création d’un lien et activation locale d’un compte | Envoi d’e-mails et invitations accessibles entre appareils |
| Données | Persistance et séparation d’espaces dans un navigateur | Base serveur, synchronisation, isolation et sauvegardes |
| Activités et dons | Course accélérée, saisie manuelle, historique privé, calcul et affectation de points | Mesure GPS/capteurs, validation d’activité et financement réel des partenaires |
| Stories | Texte/photo, expiration locale à 24 h, suppression et signalement | Accès média privé contrôlé par serveur, purge et modération de production ; vidéo éventuelle |
| Personnalisation | Logo, noms, couleurs et équipes de chaque espace | Configuration métier complète ; les barèmes de missions restent dans le code |
| Distribution | Application web et parcours d’ajout à l’écran d’accueil | Publication et validation App Store/Google Play |

## Installation web et hébergement

Le dépôt contient un manifeste et un service worker. Leur utilisation nécessite un contexte adapté, **localhost pour le développement ou HTTPS pour l’hébergement**, avec un navigateur compatible. Le bouton d’installation affiche la proposition du navigateur lorsqu’elle est disponible, sinon les instructions pour ajouter la maquette à l’écran d’accueil.

Il s’agit d’une version web : aucune application n’est publiée sur l’App Store ou Google Play. Une adresse `localhost` ouverte sur un téléphone désigne ce téléphone, pas l’ordinateur qui héberge la démo. Pour une présentation sur plusieurs téléphones, utiliser une version hébergée en HTTPS ; chaque navigateur conservera son propre jeu de données.

Le service worker met en cache les fichiers statiques de la maquette, sans API distante ni médias utilisateur. Les polices Google sont des ressources externes facultatives, avec polices de secours. Une visite préalable connectée est recommandée avant une présentation avec un réseau incertain.

## Organisation du dépôt

| Fichiers | Rôle |
|---|---|
| `index.html`, `app.js`, `app.css` | Application salarié, activités, missions, profil et fil |
| `demo-shell.js`, `demo-shell.css` | Connexion simulée, identité entreprise et outils de présentation |
| `demo-store.js` | Données locales, profils, entreprises, invitations, stories et horloge |
| `stories.js`, `stories.css` | Création et lecture des stories |
| `admin.html`, `admin.js`, `admin.css` | Portail entreprise et administration plateforme |
| `manifest.webmanifest`, `sw.js`, `icon.svg` | Manifeste, cache statique et icône web |
| `tests/` | Tests Node du stockage et des règles applicatives |
| `API-DEMO.md` | Contrat de l’API locale `Demo` |
| `explorations/` | Archives des pistes graphiques |
| `config.js`, `supabase/schema.sql` | Archives techniques pour préparer une future intégration serveur |

**La maquette actuelle ne charge pas `config.js`, ne charge pas le client Supabase et n’effectue aucun appel Supabase.** Renseigner l’ancienne configuration ne branche pas cette version à un serveur. L’ancien schéma comporte des règles de démonstration ; il devra être revu avec une authentification réelle, l’isolation des entreprises et le stockage privé des médias avant tout usage de production.

## Vérifier une modification

Avec Node.js installé :

```powershell
node --test tests/*.test.cjs
```

Compléter les tests automatisés par le parcours de [PRESENTATION.md](PRESENTATION.md), notamment création d’une story, changement d’entreprise, invitation et activité privée. Après une modification des fichiers, actualiser l’application et le portail ; en cas de version incohérente, vérifier le service worker et son cache dans les outils de développement du navigateur.

La branche de travail de cette présentation est `codex/client-demo`. Les modifications et essais locaux n’impliquent aucun push ni déploiement distant.

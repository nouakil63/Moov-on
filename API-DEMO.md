# Store local de démonstration

`demo-store.js` expose `window.Demo`, sans dépendance et sans requête réseau.
Charger ce fichier avant le shell et les interfaces stories/administration.
Les contrôles de rôle illustrent les parcours : ils ne constituent pas une
authentification ni une protection de données adaptée à la production.

## Persistance et événements

- Données partagées entre onglets : `localStorage['moovon:demo:v1']`, schéma version 1.
- Session propre à chaque onglet : `sessionStorage['moovon:demo:session:v1']`.
- Toutes les dates sont des nombres, en millisecondes depuis l’époque Unix.
- `Demo.now()` renvoie l’heure réelle augmentée du décalage de démonstration.
- `Demo.advanceHours(n)` augmente ce décalage pour tester les expirations ; une session est requise.
- `Demo.onChange(fn)` écoute les modifications de cet onglet et les événements `storage` des autres onglets. Retour : fonction de désinscription. Argument reçu : `{type}`.
- Tous les objets et listes renvoyés sont des copies. Les modifier ne sauvegarde rien.
- Les mutations écrivent avant de notifier. Un dépassement de quota lève une erreur en français et conserve le précédent enregistrement. L’interface doit afficher l’erreur, sans confirmation de réussite.
- `Demo.reset()` restaure les données initiales, déconnecte l’onglet et supprime les seules clés applicatives portant le préfixe `moovon:app:v2:`. Aucune autre donnée du navigateur n’est effacée.

## Entreprises et comptes

`Demo.orgs()` et `Demo.org(id)` sont disponibles avant connexion pour le choix
d’entreprise et son habillage. `org(id)` renvoie `null` si elle est inconnue.

`Demo.login({email,orgId})` accepte uniquement un compte local actif de l’entreprise,
ou le compte plateforme. Il renvoie `{org,user}`. Le compte plateforme peut ouvrir
l’un des deux espaces ; son `user.orgId` reste son entreprise d’origine.
`Demo.current()` renvoie la session et les valeurs à jour, ou `null` si la session
est absente ou son compte suspendu. `Demo.logout()` déconnecte cet onglet.

Comptes initiaux :

| Entreprise | Adresse | Rôle |
|---|---|---|
| Corélis | camille@corelis.fr | employee |
| Corélis | lea@corelis.fr | admin |
| Corélis | sofiane@corelis.fr | employee |
| Nova | alex@nova-conseil.fr | employee |
| Nova | sarah@nova-conseil.fr | admin |
| Corélis ou Nova | hello@moovon.demo | platform |

- `Demo.users(orgId)` : membres de l’entreprise, session du même espace requise ; plateforme autorisée entre espaces.
- `Demo.canAdmin()` : rôle `admin` ou `platform` dans une session active.
- `Demo.createOrg({name,shortName,domain,color,accent,program,adminName,adminEmail,teams})` : rôle `platform` uniquement. Retour `{org,user}` avec administrateur actif pour la démonstration, sans envoi d’e-mail. Identifiant d’entreprise généré depuis son nom court avec suffixe en cas de collision ; domaine unique, sans protocole. Objectif initial : 20 000 000. Les équipes valent `['Direction','Équipes']` si elles sont omises ; l’administrateur appartient à la première équipe. Le bleu et l’accent Corélis servent de couleurs par défaut. La session de l’opérateur reste ouverte ; appeler `Demo.login` explicitement pour montrer le nouveau compte.
- `Demo.updateProfile({name,team})` : uniquement son nom et son équipe. Les autres champs ne sont pas modifiables par cette méthode.
- `Demo.updateOrg(id,patch)` : administrateur de l’espace ou plateforme. Champs : `name`, `shortName`, `program`, `color`, `accent`, `logo`, `domain`, `teams`, `monthlyGoal`. Couleurs hexadécimales `#RRGGBB` ; une équipe utilisée ne peut pas être supprimée.
- `Demo.setUserStatus(userId,'active'|'suspended')` : administrateur du même espace ou plateforme. Interdit de changer son propre statut et celui du compte plateforme. Les comptes invités doivent d’abord accepter leur invitation. Suspendre un invité révoque ses invitations en attente.

## Invitations locales

`Demo.invite(orgId,{name,email,team,role})` est réservé à l’administration. Rôle :
`employee` ou `admin`. Retour : `{user,invite}`. L’utilisateur est `invited` et
l’invitation est `pending`, valable sept jours sur l’horloge de démonstration.
Aucun e-mail n’est envoyé.

`invite` contient `id`, `orgId`, `userId`, `email`, `token`, `createdAt`,
`expiresAt`, `status` (`pending`, `accepted` ou `revoked`).

- `Demo.getInvitation(token)` : aperçu avant connexion, ou `null` si inconnu. Retour : `{orgId,orgName,name,email,status,expiresAt}` ; le statut calculé peut aussi être `expired`.
- `Demo.acceptInvite(token)` : active le compte une seule fois et renvoie `user`. N’ouvre pas de session. Le shell enchaîne `Demo.login({email:user.email,orgId:user.orgId})`.
- `Demo.invitations(orgId)` : liste complète réservée à l’administration. Comparer `expiresAt` à `Demo.now()` pour afficher les expirations.

## Stories et modération

`Demo.getStories(orgId, {includeExpired:false})` renvoie les stories actives de
l’espace, de la plus récente à la plus ancienne. Les paramètres peuvent être omis.
`includeExpired:true` nécessite les droits administrateur. Les stories retirées
sont exclues dans les deux cas. Une story expirée conserve son statut `active`
dans les données ; sa visibilité dépend de `expiresAt`.

- `Demo.createStory({type:'text'|'photo',text,media,bg})` : auteur et entreprise viennent de la session. Texte limité à 1 000 caractères. Fond hexadécimal `#RRGGBB`. Une story texte exige un message ; une photo exige un média.
- `media` et `logo` : dataURL base64 PNG/JPEG/WebP/GIF, au maximum 1 200 000 caractères. SVG et URL distantes refusés. Le shell doit compresser les photos avant enregistrement.
- Une nouvelle story expire exactement 24 heures après `publishedAt`.
- `Demo.deleteStory(id)` : auteur ou administrateur de l’espace ; retire la story, libère son image locale et clôt ses signalements ouverts.
- `Demo.markStorySeen(id)` et `Demo.hasSeenStory(id)` : état de lecture propre à la personne et à l’espace. Une story expirée ou retirée provoque une erreur ; rafraîchir la liste si le lecteur était resté ouvert.
- `Demo.reportStory(id,reason)` : signalement avec motif requis, un seul signalement ouvert par personne et story.
- `Demo.reports(orgId)` et `Demo.dismissReport(id)` : administration uniquement.

Un signalement contient `id`, `orgId`, `storyId`, `userId`, `reason`, `status`
(`open` ou `dismissed`), `createdAt`, puis éventuellement `dismissedAt`.

`Demo.stats(orgId)` fournit à l’administration les nombres `users` (hors compte
plateforme), `activeUsers`, `invitedUsers`, `suspendedUsers`, `activeStories`,
`expiredStories` et `openReports`.

## Vérification

Exécuter `node --test tests/demo-store.test.cjs tests/app-data.test.cjs`. Les tests chargent le véritable
module dans plusieurs contextes VM avec des stockages simulés : isolation,
sessions, invitations, retrait d’accès, expiration, modération et échecs de quota.
Les tests applicatifs exécutent les fonctions de données de `app.js`, sans les
liaisons DOM : crédits privés/publics, séparation des profils et entreprises,
vélo, changement de date et absence de crédit après échec d’écriture.

// =====================================================================
// Moov'On — configuration Supabase
//
// La clé « publishable » (sb_publishable_…) est publique par conception :
// l'accès aux données est contrôlé par les politiques RLS côté Supabase.
// Ne JAMAIS mettre ici une clé secrète (sb_secret_…).
// Champs vides = la maquette fonctionne en mode local (localStorage).
// =====================================================================
window.MOOVON_SUPABASE = {
  url: 'https://rawvvkhryecxajqlaice.supabase.co',
  anonKey: 'sb_publishable_pHvj6ZoGm1wS2TMLtY1vUQ_HhEmNn-1'
};

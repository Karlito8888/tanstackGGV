# Implementation Plan

- [x] 1. Créer le AuthContext et AuthProvider
  - Créer `src/contexts/AuthContext.tsx` avec l'interface AuthContextType
  - Implémenter AuthProvider avec useState pour user, session, loading
  - Implémenter useEffect pour getSession() et onAuthStateChange()
  - Implémenter signInWithProvider pour Google et Facebook OAuth
  - Implémenter la méthode signOut
  - Créer le hook useAuth() pour accéder au context
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3, 3.5_

- [x] 2. Intégrer AuthProvider dans l'application
  - Modifier `src/main.tsx` pour wrapper l'app avec AuthProvider
  - Supprimer la logique de session dupliquée dans main.tsx
  - Supprimer le composant Auth UI de Supabase du main.tsx
  - S'assurer que AuthProvider wrap le RouterProvider
  - _Requirements: 1.1, 1.4, 4.1, 4.3_

- [x] 3. Créer une page de login avec OAuth uniquement
  - Créer `src/routes/login.tsx` avec boutons Google et Facebook
  - Utiliser le hook useAuth() pour accéder à signInWithProvider
  - Implémenter la gestion des états de chargement
  - Ajouter la gestion d'erreurs avec affichage utilisateur
  - Styliser les boutons OAuth avec les couleurs de marque appropriées
  - _Requirements: 3.1, 3.2, 3.4, 3.5_

- [x] 4. Configurer les routes protégées et le callback OAuth
  - Créer `src/routes/auth/callback.tsx` pour gérer le retour OAuth
  - Configurer la route configuration dans `src/router.tsx` qui utilise le context auth
  - Implémenter la logique de redirection pour les routes protégées
  - Ajouter beforeLoad aux routes qui nécessitent authentification
  - Implémenter la redirection automatique depuis /login si déjà connecté
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 5. Créer un composant de chargement pour l'état initial
  - Créer `src/components/ui/loading-spinner.tsx` ou similaire
  - Afficher le spinner pendant que loading === true dans AuthProvider
  - S'assurer qu'il n'y a pas de flash de contenu non authentifié
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 6. Nettoyer l'ancien code d'authentification
  - Supprimer `src/hooks/use-auth.ts` (ancien hook)
  - Supprimer toute référence à l'ancien useAuth dans les composants
  - Nettoyer les imports inutilisés
  - Vérifier qu'il n'y a plus de duplication de logique auth
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 7. Mettre à jour les composants existants pour utiliser le nouveau AuthContext
  - Identifier tous les composants qui utilisent l'ancien useAuth
  - Remplacer par le nouveau useAuth() du AuthContext
  - Mettre à jour les références à user, loading, etc.
  - Tester que chaque composant fonctionne correctement
  - _Requirements: 1.4, 4.4_

- [x] 8. Tester le flow d'authentification OAuth complet
  - Tester le login avec Google OAuth
  - Tester le login avec Facebook OAuth
  - Tester le callback OAuth et la création de session
  - Tester le logout
  - Tester les redirections automatiques
  - Tester la persistance de session (refresh page)
  - Vérifier qu'il n'y a qu'un seul appel à getSession et un seul listener
  - Tester l'annulation du flow OAuth
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.5, 4.1, 5.1, 5.2, 5.3_

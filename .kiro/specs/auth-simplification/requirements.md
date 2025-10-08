# Requirements Document

## Introduction

L'objectif est de simplifier l'authentification Supabase avec TanStack Router en combinant les meilleures pratiques des deux approches (article Medium et docs Supabase) sans sur-ingénierie. L'implémentation actuelle mélange deux patterns différents : un hook `useAuth` avec state local et une gestion de session dans `main.tsx`, créant de la duplication et de la confusion.

## Requirements

### Requirement 1

**User Story:** En tant que développeur, je veux une seule source de vérité pour l'état d'authentification, afin d'éviter la duplication et les incohérences.

#### Acceptance Criteria

1. WHEN l'application démarre THEN le système SHALL récupérer la session initiale une seule fois
2. WHEN l'état d'authentification change THEN tous les composants SHALL recevoir la mise à jour automatiquement
3. IF un utilisateur est authentifié THEN le contexte du router SHALL contenir les informations utilisateur
4. WHEN on utilise l'authentification THEN le système SHALL utiliser soit un context React soit le router context, pas les deux

### Requirement 2

**User Story:** En tant que développeur, je veux intégrer l'authentification directement avec TanStack Router, afin de gérer les redirections et les routes protégées de manière native.

#### Acceptance Criteria

1. WHEN un utilisateur non authentifié accède à une route protégée THEN le système SHALL rediriger vers la page de connexion
2. WHEN un utilisateur s'authentifie THEN le router SHALL se mettre à jour avec le nouveau contexte auth
3. WHEN on définit une route THEN on SHALL pouvoir utiliser `beforeLoad` pour vérifier l'authentification
4. IF l'utilisateur est déjà connecté THEN le système SHALL rediriger depuis la page de login vers l'application

### Requirement 3

**User Story:** En tant que développeur, je veux des méthodes d'authentification OAuth simples, afin de permettre aux utilisateurs de se connecter facilement avec Google ou Facebook.

#### Acceptance Criteria

1. WHEN on appelle signInWithProvider('google') THEN le système SHALL authentifier l'utilisateur via Google OAuth
2. WHEN on appelle signInWithProvider('facebook') THEN le système SHALL authentifier l'utilisateur via Facebook OAuth
3. WHEN on appelle signOut THEN le système SHALL déconnecter l'utilisateur et nettoyer la session
4. WHEN une action d'auth échoue THEN le système SHALL retourner une erreur claire
5. IF l'utilisateur annule le flow OAuth THEN le système SHALL gérer l'annulation proprement

### Requirement 4

**User Story:** En tant que développeur, je veux éliminer le code redondant, afin de maintenir une base de code propre et facile à comprendre.

#### Acceptance Criteria

1. WHEN on gère l'authentification THEN le système SHALL avoir un seul listener `onAuthStateChange`
2. WHEN on accède à l'utilisateur courant THEN le système SHALL utiliser une seule source (router context ou auth context)
3. WHEN on initialise l'app THEN le système SHALL éviter les appels dupliqués à `getSession()`
4. IF on a besoin de l'état auth dans un composant THEN on SHALL utiliser une API cohérente

### Requirement 5

**User Story:** En tant qu'utilisateur, je veux voir un écran de chargement pendant la vérification de la session, afin de ne pas voir de flash de contenu non authentifié.

#### Acceptance Criteria

1. WHEN l'application charge THEN le système SHALL afficher un état de chargement
2. WHEN la session est vérifiée THEN le système SHALL afficher le contenu approprié (auth UI ou app)
3. WHEN l'état d'auth change THEN la transition SHALL être fluide sans flash de contenu
4. IF la vérification prend du temps THEN l'utilisateur SHALL voir un indicateur de chargement

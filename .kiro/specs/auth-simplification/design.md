# Design Document

## Overview

Cette solution simplifie l'authentification en utilisant TanStack Router comme source unique de vérité pour l'état d'authentification. On élimine la duplication entre `useAuth` hook et la gestion de session dans `main.tsx`, en s'inspirant des meilleures pratiques de l'article Medium et des docs Supabase officielles.

L'approche privilégie la simplicité : un AuthContext React pour gérer l'état auth, intégré proprement avec TanStack Router pour les redirections et la protection des routes.

## Architecture

### Pattern choisi : AuthContext + TanStack Router

```
┌─────────────────────────────────────────┐
│           App Component                  │
│  ┌───────────────────────────────────┐  │
│  │      AuthProvider                  │  │
│  │  - Gère onAuthStateChange          │  │
│  │  - Expose user, loading, session   │  │
│  │  - Méthodes: signIn, signUp, etc.  │  │
│  │                                     │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │   RouterProvider             │  │  │
│  │  │   - Accède à auth via context│  │  │
│  │  │   - beforeLoad pour routes   │  │  │
│  │  │   - Redirections auto        │  │  │
│  │  └──────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Flux d'authentification

1. **Initialisation** : AuthProvider récupère la session initiale via `getSession()`
2. **Écoute** : Un seul listener `onAuthStateChange` dans AuthProvider
3. **Propagation** : Le context React propage l'état à tous les composants
4. **Router** : TanStack Router utilise le context pour les redirections

## Components and Interfaces

### 1. AuthContext

```typescript
interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signInWithProvider: (provider: 'google' | 'facebook') => Promise<void>
  signOut: () => Promise<void>
}
```

**Responsabilités** :
- Gérer l'état d'authentification (user, session, loading)
- Fournir les méthodes d'authentification
- Écouter les changements d'état auth avec `onAuthStateChange`
- Exposer l'état via React Context

### 2. AuthProvider Component

```typescript
function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Récupérer session initiale
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Écouter les changements
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Méthodes d'authentification...
}
```

### 3. Router Integration

Le router accède à l'auth via le context :

```typescript
// Dans un composant route
function ProtectedRoute() {
  const { user, loading } = useAuth()
  
  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" />
  
  return <YourComponent />
}
```

Ou avec `beforeLoad` de TanStack Router :

```typescript
{
  path: '/dashboard',
  beforeLoad: async ({ context }) => {
    const { user } = context.auth
    if (!user) {
      throw redirect({ to: '/login' })
    }
  }
}
```

### 4. Login Component

Composant simple qui utilise le context avec uniquement OAuth :

```typescript
function LoginPage() {
  const { signInWithProvider, loading } = useAuth()
  
  const handleGoogleLogin = async () => {
    await signInWithProvider('google')
  }
  
  const handleFacebookLogin = async () => {
    await signInWithProvider('facebook')
  }
  
  return (
    <div>
      <button onClick={handleGoogleLogin} disabled={loading}>
        Sign in with Google
      </button>
      <button onClick={handleFacebookLogin} disabled={loading}>
        Sign in with Facebook
      </button>
    </div>
  )
}
```

## Data Models

### User State

```typescript
{
  user: User | null,           // Supabase User object
  session: Session | null,     // Supabase Session object
  loading: boolean             // État de chargement initial
}
```

### Session Storage

- Géré automatiquement par Supabase dans localStorage
- Clé : `sb-<project-ref>-auth-token`
- Pas besoin de gestion manuelle

## Error Handling

### Stratégie d'erreurs

1. **Erreurs d'authentification** : Retournées par les méthodes (signIn, signUp, etc.)
   - Affichées via toast/alert
   - Pas de throw, retour d'erreur explicite

2. **Erreurs de session** : Gérées silencieusement
   - Si session invalide → user = null
   - Redirection automatique vers login

3. **Erreurs réseau** : Retry automatique par Supabase
   - Pas de gestion spéciale nécessaire

### Exemple de gestion

```typescript
const signInWithProvider = async (provider: 'google' | 'facebook') => {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
    if (error) throw error
  } catch (error) {
    console.error('OAuth login error:', error)
    // Afficher erreur à l'utilisateur
    return { error: error.message }
  }
}
```

## Testing Strategy

### Tests unitaires

1. **AuthContext** :
   - Vérifier que getSession est appelé au mount
   - Vérifier que onAuthStateChange est configuré
   - Vérifier que les méthodes auth fonctionnent

2. **AuthProvider** :
   - Tester les états loading
   - Tester les transitions user null → user présent
   - Tester le cleanup du subscription

### Tests d'intégration

1. **Flow complet de login OAuth** :
   - User non authentifié → page login
   - Clic sur bouton Google/Facebook → redirection OAuth
   - Callback → session créée → redirection vers app

2. **Flow de logout** :
   - User authentifié → appel signOut
   - Session cleared → redirection login

3. **Protection des routes** :
   - Accès route protégée sans auth → redirect login
   - Accès route protégée avec auth → affichage contenu

4. **Gestion du callback OAuth** :
   - Route /auth/callback reçoit le token
   - Session établie correctement
   - Redirection vers la page d'origine ou dashboard

### Tests E2E

1. Parcours utilisateur complet
2. Vérification de la persistance de session
3. Test des redirections automatiques

## Migration Plan

### Étapes de migration

1. **Créer AuthContext et AuthProvider** (nouveau code)
2. **Wrapper l'app avec AuthProvider** (modification de main.tsx)
3. **Supprimer l'ancien useAuth hook** (suppression)
4. **Supprimer la logique auth de main.tsx** (nettoyage)
5. **Mettre à jour les composants** qui utilisaient useAuth
6. **Tester** le flow complet

### Compatibilité

- Pas de breaking changes pour les utilisateurs finaux
- Les routes existantes continuent de fonctionner
- Migration progressive possible (garder ancien code temporairement)

## Performance Considerations

### Optimisations

1. **Un seul listener** : `onAuthStateChange` appelé une seule fois
2. **Context optimisé** : Pas de re-renders inutiles
3. **Lazy loading** : Composants auth chargés à la demande
4. **Session cache** : Supabase gère le cache automatiquement

### Métriques

- Temps de vérification session : < 100ms
- Temps de login : dépend du réseau
- Re-renders : minimaux grâce au context

## Security Considerations

1. **Tokens** : Gérés par Supabase (httpOnly cookies si configuré)
2. **PKCE Flow** : Utilisé automatiquement par Supabase
3. **Session refresh** : Automatique via Supabase
4. **XSS Protection** : Pas de stockage manuel de tokens sensibles

## Avantages de cette approche

1. ✅ **Une seule source de vérité** : AuthContext
2. ✅ **Pas de duplication** : Un seul listener, une seule récupération de session
3. ✅ **Simple à comprendre** : Pattern React standard (Context + Provider)
4. ✅ **Intégration propre** : TanStack Router accède au context naturellement
5. ✅ **Testable** : Chaque partie peut être testée indépendamment
6. ✅ **Pas de sur-ingénierie** : Code minimal et direct

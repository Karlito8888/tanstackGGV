# Database Triggers and Functions Documentation

## Overview

Ce document résume tous les triggers et fonctions PostgreSQL actuellement en place dans la base de données Supabase du projet GGVAPP.

## Auth Schema Triggers

### 1. `on_auth_user_created`

- **Type**: Trigger AFTER INSERT
- **Table**: `auth.users`
- **Fonction**: `handle_new_user()`
- **Description**: Crée automatiquement un profil dans la table `public.profiles` lorsqu'un nouvel utilisateur s'inscrit via Supabase Auth

#### Fonction `handle_new_user()`

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  user_email TEXT;
  user_full_name TEXT;
  user_avatar TEXT;
BEGIN
  -- Récupération intelligente de l'email
  user_email := COALESCE(
    NEW.email,                           -- Email principal (toujours prioritaire)
    NEW.raw_user_meta_data->>'email'     -- Email dans métadonnées (fallback)
  );

  -- Récupération intelligente du nom complet
  user_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name', -- Facebook/Google full_name
    NEW.raw_user_meta_data->>'name'       -- Facebook/Google name
  );

  -- Récupération intelligente de l'avatar
  user_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url', -- Facebook/Google avatar_url
    NEW.raw_user_meta_data->>'picture'     -- Facebook/Google picture
  );

  -- Insertion du profil avec toutes les données disponibles + 10 coins de bienvenue
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    coins,
    created_at
  )
  VALUES (
    NEW.id,
    user_email,
    user_full_name,
    user_avatar,
    10,                                  -- 10 coins offerts à chaque nouvel utilisateur
    NOW()
  );

  RETURN NEW;
END;
$function$
```

### 2. `on_auth_user_email_updated`

- **Type**: Trigger AFTER UPDATE OF email
- **Table**: `auth.users`
- **Fonction**: `handle_email_update()`
- **Description**: Met à jour automatiquement l'email dans la table `profiles` quand il est modifié dans `auth.users`

#### Fonction `handle_email_update()`

```sql
CREATE OR REPLACE FUNCTION public.handle_email_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Mettre à jour l'email dans la table profiles quand il change dans auth.users
  UPDATE profiles
  SET
    email = NEW.email,
    updated_at = NOW()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$function$
```

## Public Schema Triggers

### 1. `after_update_location_association_requests`

- **Type**: Trigger AFTER UPDATE
- **Table**: `location_association_requests`
- **Fonction**: `approve_location_request()`
- **Description**: Approuve automatiquement les associations de localisation lorsque le statut passe à 'approved'

#### Fonction `approve_location_request()`

```sql
CREATE OR REPLACE FUNCTION public.approve_location_request()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'approved' THEN
    -- Vérifier que l'association n'existe pas déjà
    IF NOT EXISTS (
      SELECT 1 FROM profile_location_associations
      WHERE profile_id = NEW.requester_id
      AND location_id = NEW.location_id
    ) THEN
      -- Insérer avec is_verified = TRUE explicitement
      INSERT INTO profile_location_associations
        (profile_id, location_id, is_verified, is_owner)
      VALUES
        (NEW.requester_id, NEW.location_id, TRUE, FALSE);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
```

### 2. `trg_onboarding_completed_after_approval`

- **Type**: Trigger AFTER UPDATE
- **Table**: `location_association_requests`
- **Fonction**: `set_onboarding_completed_after_approval()`
- **Description**: Marque l'onboarding comme complété lorsqu'une demande d'association est approuvée

#### Fonction `set_onboarding_completed_after_approval()`

```sql
CREATE OR REPLACE FUNCTION public.set_onboarding_completed_after_approval()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Log pour debugging
  RAISE NOTICE 'TRIGGER CALLED: OLD.status=%, NEW.status=%, requester_id=%', OLD.status, NEW.status, NEW.requester_id;

  -- Plus permissif: déclencher si NEW.status = 'approved' ET OLD.status != 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    RAISE NOTICE 'TRIGGER CONDITION MET: Calling bypass function for user %', NEW.requester_id;

    -- Utiliser la fonction qui bypasse RLS
    PERFORM set_onboarding_completed_bypass_rls(NEW.requester_id);

    RAISE NOTICE 'TRIGGER COMPLETED: onboarding_completed updated for user %', NEW.requester_id;
  ELSE
    RAISE NOTICE 'TRIGGER CONDITION NOT MET: OLD.status=%, NEW.status=%', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$function$
```

### 3. `auto_cleanup_expired_messages`

- **Type**: Trigger AFTER INSERT
- **Table**: `messages_header`
- **Fonction**: `trigger_cleanup_expired_messages()`
- **Description**: Nettoie automatiquement les messages expirés lorsqu'un nouveau message est inséré

#### Fonction `trigger_cleanup_expired_messages()`

```sql
CREATE OR REPLACE FUNCTION public.trigger_cleanup_expired_messages()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Nettoyer les messages expirés à chaque nouveau message
    DELETE FROM messages_header
    WHERE expires_at IS NOT NULL
    AND expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    IF deleted_count > 0 THEN
        RAISE NOTICE 'Auto-cleanup: % expired messages deleted', deleted_count;
    END IF;

    RETURN NEW;
END;
$function$
```

### 4. `trigger_auto_assign_location_to_business_inside`

- **Type**: Trigger BEFORE INSERT OR UPDATE
- **Table**: `user_business_inside`
- **Fonction**: `auto_assign_location_to_business_inside()`
- **Description**: Assigne automatiquement une localisation aux entreprises internes basée sur block/lot

#### Fonction `auto_assign_location_to_business_inside()`

```sql
CREATE OR REPLACE FUNCTION public.auto_assign_location_to_business_inside()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Si block et lot sont fournis mais pas location_id
    IF NEW.block IS NOT NULL AND NEW.lot IS NOT NULL AND NEW.location_id IS NULL THEN
        -- Essayer de trouver une location existante
        SELECT id INTO NEW.location_id
        FROM locations
        WHERE block = NEW.block::text AND lot = NEW.lot::text AND deleted_at IS NULL
        LIMIT 1;

        -- Si pas trouvé, créer une nouvelle location
        IF NEW.location_id IS NULL THEN
            INSERT INTO locations (block, lot, created_at, updated_at)
            VALUES (NEW.block::text, NEW.lot::text, timezone('utc'::text, now()), timezone('utc'::text, now()))
            RETURNING id INTO NEW.location_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$
```

### 5. `trigger_auto_assign_location_to_services`

- **Type**: Trigger BEFORE INSERT OR UPDATE
- **Table**: `user_services`
- **Fonction**: `auto_assign_location_to_services()`
- **Description**: Assigne automatiquement une localisation aux services avec priorité block/lot puis home location

#### Fonction `auto_assign_location_to_services()`

```sql
CREATE OR REPLACE FUNCTION public.auto_assign_location_to_services()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Priorité 1: Si block et lot sont fournis, les utiliser (comme business inside)
    IF NEW.block IS NOT NULL AND NEW.lot IS NOT NULL AND NEW.location_id IS NULL THEN
        -- Essayer de trouver une location existante
        SELECT id INTO NEW.location_id
        FROM locations
        WHERE block = NEW.block::text AND lot = NEW.lot::text AND deleted_at IS NULL
        LIMIT 1;

        -- Si pas trouvé, créer une nouvelle location
        IF NEW.location_id IS NULL THEN
            INSERT INTO locations (block, lot, created_at, updated_at)
            VALUES (NEW.block::text, NEW.lot::text, timezone('utc'::text, now()), timezone('utc'::text, now()))
            RETURNING id INTO NEW.location_id;
        END IF;

    -- Priorité 2: Sinon utiliser la home location (comportement existant)
    ELSIF NEW.location_id IS NULL THEN
        NEW.location_id := get_user_home_location(NEW.profile_id);
    END IF;

    RETURN NEW;
END;
$function$
```

## Fonctions Utilitaires

### 1. `add_monthly_coins()`

```sql
CREATE OR REPLACE FUNCTION public.add_monthly_coins()
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.profiles
  SET coins = coins + 10
  WHERE deleted_at IS NULL;
END;
$function$
```

### 2. `auto_assign_home_location_to_services()`

```sql
CREATE OR REPLACE FUNCTION public.auto_assign_home_location_to_services()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Only assign if location_id is not already set
    IF NEW.location_id IS NULL THEN
        NEW.location_id := get_user_home_location(NEW.profile_id);
    END IF;

    RETURN NEW;
END;
$function$
```

### 3. `cleanup_expired_messages()`

```sql
CREATE OR REPLACE FUNCTION public.cleanup_expired_messages()
RETURNS TABLE(deleted_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    deleted_rows INTEGER;
BEGIN
    -- Supprimer les messages où expires_at est dans le passé
    DELETE FROM messages_header
    WHERE expires_at IS NOT NULL
    AND expires_at < NOW();

    -- Récupérer le nombre de lignes supprimées
    GET DIAGNOSTICS deleted_rows = ROW_COUNT;

    -- Log de l'opération
    RAISE NOTICE 'Cleanup: % expired messages deleted at %', deleted_rows, NOW();

    -- Retourner le nombre de messages supprimés
    RETURN QUERY SELECT deleted_rows;
END;
$function$
```

### 4. `cleanup_expired_messages_with_details()`

```sql
CREATE OR REPLACE FUNCTION public.cleanup_expired_messages_with_details()
RETURNS TABLE(deleted_count integer, cleanup_timestamp timestamp with time zone, oldest_deleted_message timestamp with time zone, newest_deleted_message timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    deleted_rows INTEGER;
    oldest_msg TIMESTAMPTZ;
    newest_msg TIMESTAMPTZ;
BEGIN
    -- Récupérer les timestamps des messages qui vont être supprimés
    SELECT MIN(expires_at), MAX(expires_at)
    INTO oldest_msg, newest_msg
    FROM messages_header
    WHERE expires_at IS NOT NULL
    AND expires_at < NOW();

    -- Supprimer les messages expirés
    DELETE FROM messages_header
    WHERE expires_at IS NOT NULL
    AND expires_at < NOW();

    -- Récupérer le nombre de lignes supprimées
    GET DIAGNOSTICS deleted_rows = ROW_COUNT;

    -- Log de l'opération
    RAISE NOTICE 'Cleanup: % expired messages deleted at %', deleted_rows, NOW();

    -- Retourner les détails
    RETURN QUERY SELECT
        deleted_rows,
        NOW() as cleanup_timestamp,
        oldest_msg,
        newest_msg;
END;
$function$
```

### 5. `get_associated_locations_with_coords()`

```sql
CREATE OR REPLACE FUNCTION public.get_associated_locations_with_coords()
RETURNS TABLE(id uuid, block text, lot text, lng double precision, lat double precision, is_locked boolean, marker_url text, created_at timestamp with time zone, updated_at timestamp with time zone, users json)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.block,
    l.lot,
    ST_X(l.coordinates) AS lng,
    ST_Y(l.coordinates) AS lat,
    l.is_locked,
    l.marker_url,
    l.created_at,
    l.updated_at,
    json_agg(
      json_build_object(
        'id', p.id,
        'name', p.username,
        'avatar_url', p.avatar_url,
        'is_owner', pla.is_owner
      ) ORDER BY pla.is_owner DESC, p.username ASC
    ) AS users
  FROM locations l
  INNER JOIN profile_location_associations pla ON l.id = pla.location_id
  INNER JOIN profiles p ON pla.profile_id = p.id
  WHERE l.deleted_at IS NULL
  AND pla.is_verified = true
  GROUP BY l.id, l.block, l.lot, l.coordinates, l.is_locked, l.marker_url, l.created_at, l.updated_at
  ORDER BY l.block::int ASC, l.lot::int ASC;
END;
$function$
```

### 6. `get_inactive_conversations_for_cleanup()`

```sql
CREATE OR REPLACE FUNCTION public.get_inactive_conversations_for_cleanup(cutoff_date timestamp with time zone, days_inactive integer DEFAULT 30)
RETURNS TABLE(user_id uuid, partner_id uuid, partner_username text, last_message_date timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    CASE
      WHEN pm.sender_id = p1.id THEN pm.sender_id
      ELSE pm.receiver_id
    END as user_id,
    CASE
      WHEN pm.sender_id = p1.id THEN pm.receiver_id
      ELSE pm.sender_id
    END as partner_id,
    CASE
      WHEN pm.sender_id = p1.id THEN p2.username
      ELSE p1.username
    END as partner_username,
    MAX(pm.created_at) as last_message_date
  FROM private_messages pm
  JOIN profiles p1 ON p1.id = pm.sender_id
  JOIN profiles p2 ON p2.id = pm.receiver_id
  WHERE pm.created_at < cutoff_date
  GROUP BY
    CASE
      WHEN pm.sender_id = p1.id THEN pm.sender_id
      ELSE pm.receiver_id
    END,
    CASE
      WHEN pm.sender_id = p1.id THEN pm.receiver_id
      ELSE pm.sender_id
    END,
    CASE
      WHEN pm.sender_id = p1.id THEN p2.username
      ELSE p1.username
    END
  HAVING MAX(pm.created_at) < cutoff_date;
END;
$function$
```

### 7. `get_location_coordinates()`

```sql
CREATE OR REPLACE FUNCTION public.get_location_coordinates(location_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'lat', ST_Y(coordinates),
    'lng', ST_X(coordinates)
  ) INTO result
  FROM locations
  WHERE id = location_id AND deleted_at IS NULL;

  RETURN result;
END;
$function$
```

### 8. `get_locations_with_coords()`

```sql
CREATE OR REPLACE FUNCTION public.get_locations_with_coords()
RETURNS TABLE(id uuid, block text, lot text, lng double precision, lat double precision, is_locked boolean, marker_url text, created_at timestamp with time zone, updated_at timestamp with time zone, deleted_at timestamp with time zone)
LANGUAGE sql
SECURITY DEFINER
AS $function$
  SELECT
    l.id,
    l.block,
    l.lot,
    ST_X(l.coordinates) as lng,
    ST_Y(l.coordinates) as lat,
    l.is_locked,
    l.marker_url,
    l.created_at,
    l.updated_at,
    l.deleted_at
  FROM locations l
  WHERE l.deleted_at IS NULL
  ORDER BY l.block ASC, l.lot ASC;
$function$
```

### 9. `get_user_home_location()`

```sql
CREATE OR REPLACE FUNCTION public.get_user_home_location(user_profile_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $function$
DECLARE
    home_location_id UUID;
BEGIN
    SELECT location_id INTO home_location_id
    FROM profile_location_associations
    WHERE profile_id = user_profile_id
      AND is_owner = true
      AND is_verified = true
    LIMIT 1;

    RETURN home_location_id;
END;
$function$
```

### 10. `publish_header_message()`

```sql
CREATE OR REPLACE FUNCTION public.publish_header_message(p_user_id uuid, p_message text, p_expires_at timestamp with time zone, p_coins integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  user_coins integer;
BEGIN
  -- Check user coins
  SELECT coins INTO user_coins FROM profiles WHERE id = p_user_id;
  IF user_coins IS NULL OR user_coins < p_coins THEN
    RAISE EXCEPTION 'Not enough coins';
  END IF;
  -- Insert message
  INSERT INTO messages_header (user_id, message, created_at, updated_at, expires_at, coins_spent)
  VALUES (p_user_id, p_message, now(), now(), p_expires_at, p_coins);
  -- Deduct coins
  UPDATE profiles SET coins = coins - p_coins WHERE id = p_user_id;
END;
$function$
```

### 11. `set_onboarding_completed_bypass_rls()`

```sql
CREATE OR REPLACE FUNCTION public.set_onboarding_completed_bypass_rls(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  UPDATE profiles
  SET onboarding_completed = true, updated_at = now()
  WHERE id = user_id;
END;
$function$
```

### 12. `update_conversation_visibility_updated_at()`

```sql
CREATE OR REPLACE FUNCTION public.update_conversation_visibility_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$function$
```

### 13. `update_updated_at_column()`

```sql
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$function$
```

### 14. `get_location_owner()`

```sql
CREATE OR REPLACE FUNCTION public.get_location_owner(location_id_param uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    owner_id uuid;
BEGIN
    SELECT profile_id INTO owner_id
    FROM profile_location_associations
    WHERE location_id = location_id_param
      AND is_owner = true
      AND is_verified = true
    LIMIT 1;

    RETURN owner_id;
END;
$function$
```

## Résumé des Fonctionnalités Automatisées

### 🔐 Authentification

- **Création automatique de profils** : Les nouveaux utilisateurs reçoivent automatiquement un profil avec 10 coins de bienvenue
- **Synchronisation des emails** : Les changements d'email dans auth.users sont répercutés dans profiles

### 📍 Gestion des Localisations

- **Auto-assignation** : Les entreprises et services reçoivent automatiquement une localisation basée sur block/lot
- **Création dynamique** : Nouvelles localisations créées automatiquement si nécessaires
- **Home location fallback** : Utilisation de la localisation principale si block/lot non fournis

### 💰 Système de Coins

- **Bonus de bienvenue** : 10 coins offerts à chaque nouvel utilisateur
- **Débit automatique** : Coins déduits lors de la publication de messages

### 🏠 Onboarding

- **Complétion automatique** : L'onboarding est marqué comme complété lors de l'approbation d'une demande d'association

### 🧹 Maintenance Automatique

- **Nettoyage des messages** : Les messages expirés sont supprimés automatiquement
- **Mise à jour des timestamps** : Les champs `updated_at` sont gérés automatiquement

### 🔒 Sécurité

- **RLS Bypass** : Certaines fonctions utilisent `SECURITY DEFINER` pour contourner RLS lorsque nécessaire
- **Validation des données** : Vérifications automatiques lors des insertions/mises à jour

## Notes Importantes

1. **Toutes les fonctions sont en français** pour correspondre au contexte de l'application
2. **La gestion des coins est automatisée** et sécurisée
3. **Le système de localisation est intelligent** avec création dynamique
4. **L'onboarding est géré automatiquement** via les triggers d'approbation
5. **La maintenance est automatisée** pour les données temporaires

## ⚠️ **Coordination avec les Hooks React (Mise à jour 2025-10-07)**

### Fonctions de Sécurité Ajoutées

Pour éviter les conflits entre les triggers PostgreSQL et les hooks React, les fonctions suivantes ont été ajoutées :

#### 1. **Gestion des Profils**

- `safe_complete_onboarding(user_id)` : Complétion sécurisée de l'onboarding qui vérifie l'état du trigger
- `safe_update_coins(user_id, new_coins, operation)` : Mise à jour sécurisée des coins avec validation
- `get_onboarding_completion_info(user_id)` : Informations sur la source de complétion de l'onboarding

#### 2. **Gestion des Localisations**

- `get_location_assignment_info(table_name, record_id)` : Informations sur l'assignation des localisations
- Triggers améliorés avec détection de conflits et logging détaillé

#### 3. **Gestion des Messages**

- `cleanup_expired_messages_with_coordination(force, source)` : Nettoyage coordonné qui respecte l'activité des triggers
- `get_cleanup_statistics()` : Statistiques de nettoyage pour coordination
- `coordinated_cleanup()` : Nettoyage intelligent qui évite les opérations redondantes

### Règles de Coordination

1. **Profils** : Utiliser `safe_complete_onboarding()` au lieu de la mise à jour directe
2. **Coins** : Utiliser `safe_update_coins()` avec validation au lieu de la mise à jour directe
3. **Localisations** : Les triggers gèrent l'assignation automatique, les hooks ne doivent pas modifier location_id/block/lot
4. **Messages** : Utiliser `coordinated_cleanup()` pour éviter les conflits avec le trigger de nettoyage

Cette architecture permet une gestion robuste et automatisée des données utilisateur tout en maintenant la cohérence et la sécurité de la base de données.

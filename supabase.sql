-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.business_inside_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (char_length(name) >= 2 AND char_length(name) <= 100),
  description text,
  icon text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT business_inside_categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.business_outside_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (char_length(name) >= 2 AND char_length(name) <= 100),
  description text,
  icon text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT business_outside_categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.chat (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  channel_id text NOT NULL,
  user_id uuid,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  is_edited boolean DEFAULT false,
  reply_to uuid,
  CONSTRAINT chat_pkey PRIMARY KEY (id),
  CONSTRAINT messages_reply_to_fkey FOREIGN KEY (reply_to) REFERENCES public.chat(id),
  CONSTRAINT messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.conversation_cleanup_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notification_sent_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  cleanup_scheduled_at timestamp with time zone NOT NULL,
  conversations_count integer NOT NULL DEFAULT 0,
  is_acknowledged boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT conversation_cleanup_notifications_pkey PRIMARY KEY (id),
  CONSTRAINT conversation_cleanup_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.conversation_deletions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  deleted_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  last_message_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT conversation_deletions_pkey PRIMARY KEY (id),
  CONSTRAINT conversation_deletions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT conversation_deletions_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.profiles(id),
  CONSTRAINT conversation_deletions_last_message_id_fkey FOREIGN KEY (last_message_id) REFERENCES public.private_messages(id)
);
CREATE TABLE public.forums (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  icon text,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT forums_pkey PRIMARY KEY (id),
  CONSTRAINT forums_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.location_association_requests (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  approver_id uuid,
  requester_id uuid,
  location_id uuid,
  status text NOT NULL CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  approved_at timestamp with time zone,
  rejected_at timestamp with time zone,
  CONSTRAINT location_association_requests_pkey PRIMARY KEY (id),
  CONSTRAINT location_association_requests_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id),
  CONSTRAINT location_association_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.profiles(id),
  CONSTRAINT location_association_requests_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  block text NOT NULL,
  lot text NOT NULL,
  coordinates USER-DEFINED,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  deleted_at timestamp with time zone,
  is_locked boolean DEFAULT false,
  marker_url text DEFAULT '/default-marker.png'::text,
  CONSTRAINT locations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.marketplace_listings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(title) >= 2 AND char_length(title) <= 100),
  description text CHECK (char_length(description) <= 1000),
  price numeric CHECK (price >= 0::numeric),
  currency text DEFAULT 'PHP'::text CHECK (currency = ANY (ARRAY['PHP'::text, 'USD'::text])),
  listing_type text NOT NULL CHECK (listing_type = ANY (ARRAY['selling'::text, 'buying'::text])),
  category text,
  location_description text,
  contact_method text CHECK (contact_method = ANY (ARRAY['phone'::text, 'message'::text, 'both'::text])),
  photo_1_url text,
  photo_2_url text,
  photo_3_url text,
  photo_4_url text,
  photo_5_url text,
  is_active boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  status text DEFAULT 'available'::text CHECK (status = ANY (ARRAY['available'::text, 'pending'::text, 'sold'::text, 'expired'::text])),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  expires_at timestamp with time zone,
  CONSTRAINT marketplace_listings_pkey PRIMARY KEY (id),
  CONSTRAINT marketplace_listings_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.messages_header (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  coins_spent integer DEFAULT 0,
  expires_at timestamp with time zone,
  CONSTRAINT messages_header_pkey PRIMARY KEY (id),
  CONSTRAINT messages_header_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.private_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  message text NOT NULL,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  deleted_at timestamp with time zone,
  attachment_url text,
  attachment_type text,
  message_type text DEFAULT 'text'::text CHECK (message_type = ANY (ARRAY['text'::text, 'image'::text, 'file'::text, 'location'::text])),
  reply_to uuid,
  is_edited boolean DEFAULT false,
  CONSTRAINT private_messages_pkey PRIMARY KEY (id),
  CONSTRAINT private_messages_reply_to_fkey FOREIGN KEY (reply_to) REFERENCES public.private_messages(id),
  CONSTRAINT private_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id),
  CONSTRAINT private_messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.profile_location_associations (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  location_id uuid,
  is_verified boolean DEFAULT false,
  is_owner boolean DEFAULT false,
  profile_id uuid NOT NULL,
  CONSTRAINT profile_location_associations_pkey PRIMARY KEY (id),
  CONSTRAINT profile_location_associations_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id),
  CONSTRAINT profile_location_associations_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text CHECK (full_name IS NULL OR char_length(full_name) <= 100),
  username text UNIQUE CHECK (username IS NULL OR char_length(username) >= 3),
  email text UNIQUE CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+[.][A-Za-z]+$'::text),
  avatar_url text,
  description text CHECK (description IS NULL OR char_length(description) <= 700),
  occupation text,
  facebook_url text,
  messenger_url text,
  viber_number text,
  whatsapp_number text,
  coins integer NOT NULL DEFAULT 10,
  is_admin boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone,
  onboarding_completed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  deleted_at timestamp with time zone,
  last_daily_checkin timestamp with time zone,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_user_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.service_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (char_length(name) >= 2 AND char_length(name) <= 100),
  description text,
  icon text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT service_categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.spatial_ref_sys (
  srid integer NOT NULL CHECK (srid > 0 AND srid <= 998999),
  auth_name character varying,
  auth_srid integer,
  srtext character varying,
  proj4text character varying,
  CONSTRAINT spatial_ref_sys_pkey PRIMARY KEY (srid)
);
CREATE TABLE public.threads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  forum_id uuid,
  title text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT threads_pkey PRIMARY KEY (id),
  CONSTRAINT threads_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT threads_forum_id_fkey FOREIGN KEY (forum_id) REFERENCES public.forums(id)
);
CREATE TABLE public.user_business_inside (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  category_id uuid NOT NULL,
  business_name text NOT NULL CHECK (char_length(business_name) >= 2 AND char_length(business_name) <= 100),
  description text CHECK (description IS NULL OR char_length(description) <= 1000),
  email text CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+[.][A-Za-z]+$'::text),
  website_url text CHECK (website_url IS NULL OR website_url ~* '^https?://'::text),
  photo_1_url text,
  photo_2_url text,
  photo_3_url text,
  is_active boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  location_id uuid,
  photo_4_url text,
  photo_5_url text,
  phone_number text,
  phone_type text CHECK (phone_type = ANY (ARRAY['landline'::text, 'mobile'::text, 'viber'::text, 'whatsapp'::text])),
  hours text,
  facebook_url text,
  block text,
  lot text,
  CONSTRAINT user_business_inside_pkey PRIMARY KEY (id),
  CONSTRAINT user_business_inside_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id),
  CONSTRAINT user_business_inside_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT user_business_inside_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.business_inside_categories(id)
);
CREATE TABLE public.user_business_outside (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  category_id uuid NOT NULL,
  business_name text NOT NULL CHECK (char_length(business_name) >= 2 AND char_length(business_name) <= 100),
  description text CHECK (description IS NULL OR char_length(description) <= 1000),
  phone_number text,
  email text CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+[.][A-Za-z]+$'::text),
  website_url text CHECK (website_url IS NULL OR website_url ~* '^https?://'::text),
  address text,
  city text,
  postal_code text,
  province text,
  photo_1_url text,
  photo_2_url text,
  photo_3_url text,
  is_active boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  barangay text,
  google_maps_link text,
  photo_4_url text,
  photo_5_url text,
  hours text,
  facebook_url text,
  phone_type text,
  CONSTRAINT user_business_outside_pkey PRIMARY KEY (id),
  CONSTRAINT user_business_outside_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT user_business_outside_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.business_outside_categories(id)
);
CREATE TABLE public.user_services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  category_id uuid NOT NULL,
  description text CHECK (description IS NULL OR char_length(description) <= 1000),
  price_range text,
  availability text,
  is_mobile boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  location_id uuid,
  service_location_type text CHECK (service_location_type = ANY (ARRAY['at_provider'::text, 'mobile'::text, 'both'::text])),
  photo_1_url text,
  photo_2_url text,
  photo_3_url text,
  photo_4_url text,
  photo_5_url text,
  facebook_url text,
  block text,
  lot text,
  CONSTRAINT user_services_pkey PRIMARY KEY (id),
  CONSTRAINT user_services_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id),
  CONSTRAINT user_services_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT user_services_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.service_categories(id)
);
export type Database = {
  profiles: {
    id: string
    full_name: string | null
    username: string | null
    email: string | null
    avatar_url: string | null
    description: string | null
    occupation: string | null
    facebook_url: string | null
    messenger_url: string | null
    viber_number: string | null
    whatsapp_number: string | null
    coins: number
    is_admin: boolean
    updated_at: string | null
    onboarding_completed: boolean
    created_at: string
    deleted_at: string | null
    last_daily_checkin: string | null
  }
  locations: {
    id: string
    block: string
    lot: string
    coordinates: any
    created_at: string
    updated_at: string
    deleted_at: string | null
    is_locked: boolean
    marker_url: string
  }
  business_inside_categories: {
    id: string
    name: string
    description: string | null
    icon: string | null
    is_active: boolean
    created_at: string
    updated_at: string
  }
  business_outside_categories: {
    id: string
    name: string
    description: string | null
    icon: string | null
    is_active: boolean
    created_at: string
    updated_at: string
  }
  service_categories: {
    id: string
    name: string
    description: string | null
    icon: string | null
    is_active: boolean
    created_at: string
    updated_at: string
  }
  user_business_inside: {
    id: string
    profile_id: string
    category_id: string
    business_name: string
    description: string | null
    email: string | null
    website_url: string | null
    photo_1_url: string | null
    photo_2_url: string | null
    photo_3_url: string | null
    photo_4_url: string | null
    photo_5_url: string | null
    is_active: boolean
    is_featured: boolean
    created_at: string
    updated_at: string
    location_id: string | null
    phone_number: string | null
    phone_type: 'landline' | 'mobile' | 'viber' | 'whatsapp' | null
    hours: string | null
    facebook_url: string | null
    block: string | null
    lot: string | null
  }
  user_business_outside: {
    id: string
    profile_id: string
    category_id: string
    business_name: string
    description: string | null
    phone_number: string | null
    email: string | null
    website_url: string | null
    address: string | null
    city: string | null
    postal_code: string | null
    province: string | null
    photo_1_url: string | null
    photo_2_url: string | null
    photo_3_url: string | null
    photo_4_url: string | null
    photo_5_url: string | null
    is_active: boolean
    is_featured: boolean
    created_at: string
    updated_at: string
    barangay: string | null
    google_maps_link: string | null
    hours: string | null
    facebook_url: string | null
    phone_type: string | null
  }
  user_services: {
    id: string
    profile_id: string
    category_id: string
    description: string | null
    price_range: string | null
    availability: string | null
    is_mobile: boolean
    is_active: boolean
    created_at: string
    updated_at: string
    location_id: string | null
    service_location_type: 'at_provider' | 'mobile' | 'both' | null
    photo_1_url: string | null
    photo_2_url: string | null
    photo_3_url: string | null
    photo_4_url: string | null
    photo_5_url: string | null
    facebook_url: string | null
    block: string | null
    lot: string | null
  }
  marketplace_listings: {
    id: string
    profile_id: string
    title: string
    description: string | null
    price: number | null
    currency: 'PHP' | 'USD'
    listing_type: 'selling' | 'buying'
    category: string | null
    location_description: string | null
    contact_method: 'phone' | 'message' | 'both' | null
    photo_1_url: string | null
    photo_2_url: string | null
    photo_3_url: string | null
    photo_4_url: string | null
    photo_5_url: string | null
    is_active: boolean
    is_featured: boolean
    status: 'available' | 'pending' | 'sold' | 'expired'
    created_at: string
    updated_at: string
    expires_at: string | null
  }
  private_messages: {
    id: string
    sender_id: string
    receiver_id: string
    message: string
    read_at: string | null
    created_at: string
    updated_at: string
    deleted_at: string | null
    attachment_url: string | null
    attachment_type: string | null
    message_type: 'text' | 'image' | 'file' | 'location'
    reply_to: string | null
    is_edited: boolean
  }
  chat: {
    id: string
    channel_id: string
    user_id: string | null
    content: string
    created_at: string
    updated_at: string
    is_edited: boolean
    reply_to: string | null
  }
  forums: {
    id: string
    title: string
    description: string | null
    icon: string | null
    created_at: string
    created_by: string | null
  }
  threads: {
    id: string
    forum_id: string | null
    title: string
    created_by: string | null
    created_at: string
  }
  profile_location_associations: {
    id: number
    location_id: string | null
    is_verified: boolean
    is_owner: boolean
    profile_id: string
  }
  location_association_requests: {
    id: number
    approver_id: string | null
    requester_id: string
    location_id: string
    status: 'pending' | 'approved' | 'rejected'
    created_at: string
    approved_at: string | null
    rejected_at: string | null
  }
  messages_header: {
    id: string
    user_id: string | null
    message: string
    created_at: string
    updated_at: string
    coins_spent: number
    expires_at: string | null
  }
  conversation_cleanup_notifications: {
    id: string
    user_id: string
    notification_sent_at: string
    cleanup_scheduled_at: string
    conversations_count: number
    is_acknowledged: boolean
    created_at: string
  }
  conversation_deletions: {
    id: string
    user_id: string
    participant_id: string
    deleted_at: string
    last_message_id: string | null
    created_at: string
  }
}

export type TableName = keyof Database
export type Row<T extends TableName> = Database[T]
export type InsertRow<T extends TableName> = Omit<
  Database[T],
  'id' | 'created_at' | 'updated_at'
>
export type UpdateRow<T extends TableName> = Partial<InsertRow<T>>

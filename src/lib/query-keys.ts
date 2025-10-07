/**
 * Query Keys Factory for TanStack Query
 *
 * This file defines a hierarchical query key structure following TanStack Query best practices.
 * All query keys are typed with `as const` for TypeScript inference.
 *
 * The structure allows for precise cache invalidation:
 * - queryKeys.profiles.all invalidates all profile queries
 * - queryKeys.profiles.lists() invalidates all profile list queries
 * - queryKeys.profiles.list(filters) invalidates only specific filtered lists
 */

export const queryKeys = {
  // Profiles
  profiles: {
    all: ['profiles'] as const,
    lists: () => [...queryKeys.profiles.all, 'list'] as const,
    list: (filters?: ProfileFilters) =>
      [...queryKeys.profiles.lists(), filters] as const,
    details: () => [...queryKeys.profiles.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.profiles.details(), id] as const,
    byUsername: (username: string) =>
      [...queryKeys.profiles.all, 'username', username] as const,
    currentUser: () => [...queryKeys.profiles.all, 'current'] as const,
    dailyCheckin: (profileId: string) =>
      [...queryKeys.profiles.all, 'daily-checkin', profileId] as const,
  },

  // Locations
  locations: {
    all: ['locations'] as const,
    lists: () => [...queryKeys.locations.all, 'list'] as const,
    list: (filters?: LocationFilters) =>
      [...queryKeys.locations.lists(), filters] as const,
    details: () => [...queryKeys.locations.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.locations.details(), id] as const,
    nearby: (lat: number, lng: number, radius?: number) =>
      [...queryKeys.locations.all, 'nearby', lat, lng, radius] as const,
    byBlock: (block: string) =>
      [...queryKeys.locations.all, 'block', block] as const,
    search: (query: string) =>
      [...queryKeys.locations.all, 'search', query] as const,
  },

  // Business Inside
  businessInside: {
    all: ['business-inside'] as const,
    lists: () => [...queryKeys.businessInside.all, 'list'] as const,
    list: (filters?: BusinessFilters) =>
      [...queryKeys.businessInside.lists(), filters] as const,
    details: () => [...queryKeys.businessInside.all, 'detail'] as const,
    detail: (id: string) =>
      [...queryKeys.businessInside.details(), id] as const,
    byProfile: (profileId: string) =>
      [...queryKeys.businessInside.all, 'profile', profileId] as const,
    byCategory: (categoryId: string) =>
      [...queryKeys.businessInside.all, 'category', categoryId] as const,
    byType: (type: string) =>
      [...queryKeys.businessInside.all, 'type', type] as const,
    search: (query: string) =>
      [...queryKeys.businessInside.all, 'search', query] as const,
  },

  // Business Outside
  businessOutside: {
    all: ['business-outside'] as const,
    lists: () => [...queryKeys.businessOutside.all, 'list'] as const,
    list: (filters?: BusinessFilters) =>
      [...queryKeys.businessOutside.lists(), filters] as const,
    details: () => [...queryKeys.businessOutside.all, 'detail'] as const,
    detail: (id: string) =>
      [...queryKeys.businessOutside.details(), id] as const,
    byProfile: (profileId: string) =>
      [...queryKeys.businessOutside.all, 'profile', profileId] as const,
    byCategory: (categoryId: string) =>
      [...queryKeys.businessOutside.all, 'category', categoryId] as const,
    featured: () => [...queryKeys.businessOutside.all, 'featured'] as const,
    search: (query: string) =>
      [...queryKeys.businessOutside.all, 'search', query] as const,
  },

  // Services
  services: {
    all: ['services'] as const,
    lists: () => [...queryKeys.services.all, 'list'] as const,
    list: (filters?: ServiceFilters) =>
      [...queryKeys.services.lists(), filters] as const,
    details: () => [...queryKeys.services.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.services.details(), id] as const,
    byProfile: (profileId: string) =>
      [...queryKeys.services.all, 'profile', profileId] as const,
    byCategory: (categoryId: string) =>
      [...queryKeys.services.all, 'category', categoryId] as const,
    mobile: () => [...queryKeys.services.all, 'mobile'] as const,
    search: (query: string) =>
      [...queryKeys.services.all, 'search', query] as const,
    updatePhotos: (serviceId: string) =>
      [...queryKeys.services.all, 'update-photos', serviceId] as const,
  },

  // Categories
  categories: {
    businessInside: ['categories', 'business-inside'] as const,
    businessOutside: ['categories', 'business-outside'] as const,
    services: ['categories', 'services'] as const,
    all: ['categories'] as const,
  },

  // Business Inside Categories
  businessInsideCategories: {
    all: ['business-inside-categories'] as const,
    lists: () => [...queryKeys.businessInsideCategories.all, 'list'] as const,
    list: (filters?: BusinessFilters) =>
      [...queryKeys.businessInsideCategories.lists(), filters] as const,
    details: () =>
      [...queryKeys.businessInsideCategories.all, 'detail'] as const,
    detail: (id: string) =>
      [...queryKeys.businessInsideCategories.details(), id] as const,
    active: () =>
      [...queryKeys.businessInsideCategories.all, 'active'] as const,
    search: (query: string) =>
      [...queryKeys.businessInsideCategories.all, 'search', query] as const,
  },

  // Business Outside Categories
  businessOutsideCategories: {
    all: ['business-outside-categories'] as const,
    lists: () => [...queryKeys.businessOutsideCategories.all, 'list'] as const,
    list: (filters?: BusinessFilters) =>
      [...queryKeys.businessOutsideCategories.lists(), filters] as const,
    details: () =>
      [...queryKeys.businessOutsideCategories.all, 'detail'] as const,
    detail: (id: string) =>
      [...queryKeys.businessOutsideCategories.details(), id] as const,
    active: () =>
      [...queryKeys.businessOutsideCategories.all, 'active'] as const,
    search: (query: string) =>
      [...queryKeys.businessOutsideCategories.all, 'search', query] as const,
  },

  // Service Categories
  serviceCategories: {
    all: ['service-categories'] as const,
    lists: () => [...queryKeys.serviceCategories.all, 'list'] as const,
    list: (filters?: ServiceFilters) =>
      [...queryKeys.serviceCategories.lists(), filters] as const,
    details: () => [...queryKeys.serviceCategories.all, 'detail'] as const,
    detail: (id: string) =>
      [...queryKeys.serviceCategories.details(), id] as const,
    active: () => [...queryKeys.serviceCategories.all, 'active'] as const,
    search: (query: string) =>
      [...queryKeys.serviceCategories.all, 'search', query] as const,
  },

  // Chat
  chat: {
    all: ['chat'] as const,
    lists: () => [...queryKeys.chat.all, 'list'] as const,
    list: (filters?: ChatFilters) =>
      [...queryKeys.chat.lists(), filters] as const,
    details: () => [...queryKeys.chat.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.chat.details(), id] as const,
    byChannel: (channelId: string) =>
      [...queryKeys.chat.all, 'channel', channelId] as const,
    byUser: (userId: string) =>
      [...queryKeys.chat.all, 'user', userId] as const,
    replies: (messageId: string) =>
      [...queryKeys.chat.all, 'replies', messageId] as const,
    search: (query: string) =>
      [...queryKeys.chat.all, 'search', query] as const,
  },

  // Messages Header
  messagesHeader: {
    all: ['messages-header'] as const,
    lists: () => [...queryKeys.messagesHeader.all, 'list'] as const,
    list: (filters?: MessagesHeaderFilters) =>
      [...queryKeys.messagesHeader.lists(), filters] as const,
    details: () => [...queryKeys.messagesHeader.all, 'detail'] as const,
    detail: (id: string) =>
      [...queryKeys.messagesHeader.details(), id] as const,
    byUser: (userId: string) =>
      [...queryKeys.messagesHeader.all, 'user', userId] as const,
    active: () => [...queryKeys.messagesHeader.all, 'active'] as const,
    expired: () => [...queryKeys.messagesHeader.all, 'expired'] as const,
    search: (query: string) =>
      [...queryKeys.messagesHeader.all, 'search', query] as const,
  },

  // Forums
  forums: {
    all: ['forums'] as const,
    lists: () => [...queryKeys.forums.all, 'list'] as const,
    list: (filters?: ForumFilters) =>
      [...queryKeys.forums.lists(), filters] as const,
    details: () => [...queryKeys.forums.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.forums.details(), id] as const,
    byCreator: (creatorId: string) =>
      [...queryKeys.forums.all, 'creator', creatorId] as const,
    search: (query: string) =>
      [...queryKeys.forums.all, 'search', query] as const,
  },

  // Threads
  threads: {
    all: ['threads'] as const,
    lists: () => [...queryKeys.threads.all, 'list'] as const,
    list: (filters?: ThreadFilters) =>
      [...queryKeys.threads.lists(), filters] as const,
    details: () => [...queryKeys.threads.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.threads.details(), id] as const,
    byForum: (forumId: string) =>
      [...queryKeys.threads.all, 'forum', forumId] as const,
    byCreator: (creatorId: string) =>
      [...queryKeys.threads.all, 'creator', creatorId] as const,
    search: (query: string) =>
      [...queryKeys.threads.all, 'search', query] as const,
  },

  // Location Association Requests
  locationAssociationRequests: {
    all: ['location-association-requests'] as const,
    lists: () =>
      [...queryKeys.locationAssociationRequests.all, 'list'] as const,
    list: (filters?: LocationAssociationRequestsFilters) =>
      [...queryKeys.locationAssociationRequests.lists(), filters] as const,
    details: () =>
      [...queryKeys.locationAssociationRequests.all, 'detail'] as const,
    detail: (id: string) =>
      [...queryKeys.locationAssociationRequests.details(), id] as const,
    byRequester: (requesterId: string) =>
      [
        ...queryKeys.locationAssociationRequests.all,
        'requester',
        requesterId,
      ] as const,
    byLocation: (locationId: string) =>
      [
        ...queryKeys.locationAssociationRequests.all,
        'location',
        locationId,
      ] as const,
    byApprover: (approverId: string) =>
      [
        ...queryKeys.locationAssociationRequests.all,
        'approver',
        approverId,
      ] as const,
    pending: () =>
      [...queryKeys.locationAssociationRequests.all, 'pending'] as const,
  },

  // Marketplace Listings
  marketplaceListings: {
    all: ['marketplace-listings'] as const,
    lists: () => [...queryKeys.marketplaceListings.all, 'list'] as const,
    list: (filters?: MarketplaceFilters) =>
      [...queryKeys.marketplaceListings.lists(), filters] as const,
    details: () => [...queryKeys.marketplaceListings.all, 'detail'] as const,
    detail: (id: string) =>
      [...queryKeys.marketplaceListings.details(), id] as const,
    byProfile: (profileId: string) =>
      [...queryKeys.marketplaceListings.all, 'profile', profileId] as const,
    byCategory: (category: string) =>
      [...queryKeys.marketplaceListings.all, 'category', category] as const,
    byType: (listingType: string) =>
      [...queryKeys.marketplaceListings.all, 'type', listingType] as const,
    featured: () => [...queryKeys.marketplaceListings.all, 'featured'] as const,
    active: () => [...queryKeys.marketplaceListings.all, 'active'] as const,
    search: (query: string) =>
      [...queryKeys.marketplaceListings.all, 'search', query] as const,
  },

  // Profile Location Associations
  profileLocationAssociations: {
    all: ['profile-location-associations'] as const,
    lists: () =>
      [...queryKeys.profileLocationAssociations.all, 'list'] as const,
    list: (filters?: ProfileLocationAssociationsFilters) =>
      [...queryKeys.profileLocationAssociations.lists(), filters] as const,
    details: () =>
      [...queryKeys.profileLocationAssociations.all, 'detail'] as const,
    detail: (id: string) =>
      [...queryKeys.profileLocationAssociations.details(), id] as const,
    byProfile: (profileId: string) =>
      [
        ...queryKeys.profileLocationAssociations.all,
        'profile',
        profileId,
      ] as const,
    byLocation: (locationId: string) =>
      [
        ...queryKeys.profileLocationAssociations.all,
        'location',
        locationId,
      ] as const,
    verified: () =>
      [...queryKeys.profileLocationAssociations.all, 'verified'] as const,
    owners: () =>
      [...queryKeys.profileLocationAssociations.all, 'owners'] as const,
  },

  // Private Messages
  privateMessages: {
    all: ['private-messages'] as const,
    lists: () => [...queryKeys.privateMessages.all, 'list'] as const,
    list: (filters?: PrivateMessageFilters) =>
      [...queryKeys.privateMessages.lists(), filters] as const,
    details: () => [...queryKeys.privateMessages.all, 'detail'] as const,
    detail: (id: string) =>
      [...queryKeys.privateMessages.details(), id] as const,
    conversations: (userId: string) =>
      [...queryKeys.privateMessages.all, 'conversations', userId] as const,
    conversation: (userId1: string, userId2: string) =>
      [
        ...queryKeys.privateMessages.all,
        'conversation',
        userId1,
        userId2,
      ] as const,
    sent: (senderId: string) =>
      [...queryKeys.privateMessages.all, 'sent', senderId] as const,
    received: (receiverId: string) =>
      [...queryKeys.privateMessages.all, 'received', receiverId] as const,
    unread: (userId: string) =>
      [...queryKeys.privateMessages.all, 'unread', userId] as const,
    unreadCount: (userId: string) =>
      [...queryKeys.privateMessages.all, 'unread-count', userId] as const,
    replies: (messageId: string) =>
      [...queryKeys.privateMessages.all, 'replies', messageId] as const,
    search: (query: string, userId?: string) =>
      userId
        ? ([...queryKeys.privateMessages.all, 'search', query, userId] as const)
        : ([...queryKeys.privateMessages.all, 'search', query] as const),
  },
} as const

// Type definitions for filters
export interface ProfileFilters {
  status?: 'active' | 'inactive' | 'suspended'
  isAdmin?: boolean
  is_admin?: boolean
  coinsMin?: number
  coinsMax?: number
  onboarded?: boolean
  onboarding_completed?: boolean
  search?: string
  limit?: number
  offset?: number
}

export interface LocationFilters {
  block?: string
  active?: boolean
  type?: 'residential' | 'commercial' | 'mixed'
  hasBusiness?: boolean
}

export interface BusinessFilters {
  profileId?: string
  categoryId?: string
  active?: boolean
  featured?: boolean
  type?: string
  block?: string
}

export interface ServiceFilters {
  profileId?: string
  categoryId?: string
  active?: boolean
  mobile?: boolean
  type?: string
  block?: string
  priceMin?: number
  priceMax?: number
}

export interface ChatFilters {
  channelId?: string
  userId?: string
  replyTo?: string
  isEdited?: boolean
  limit?: number
  offset?: number
  search?: string
}

export interface MessagesHeaderFilters {
  userId?: string
  active?: boolean
  expired?: boolean
  coinsSpentMin?: number
  coinsSpentMax?: number
  search?: string
  limit?: number
  offset?: number
}

export interface ForumFilters {
  creatorId?: string
  search?: string
  limit?: number
  offset?: number
}

export interface ThreadFilters {
  forumId?: string
  creatorId?: string
  search?: string
  limit?: number
  offset?: number
}

export interface LocationAssociationRequestsFilters {
  requesterId?: string
  locationId?: string
  approverId?: string
  status?: 'pending' | 'approved' | 'rejected'
  limit?: number
  offset?: number
}

export interface MarketplaceFilters {
  profileId?: string
  category?: string
  listingType?: 'selling' | 'buying'
  status?: 'available' | 'pending' | 'sold' | 'expired'
  featured?: boolean
  active?: boolean
  priceMin?: number
  priceMax?: number
  search?: string
  limit?: number
  offset?: number
}

export interface ProfileLocationAssociationsFilters {
  profileId?: string
  locationId?: string
  isVerified?: boolean
  isOwner?: boolean
  limit?: number
  offset?: number
}

export interface PrivateMessageFilters {
  senderId?: string
  receiverId?: string
  messageType?: 'text' | 'image' | 'file' | 'location'
  isRead?: boolean
  isEdited?: boolean
  hasAttachment?: boolean
  replyTo?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  limit?: number
  offset?: number
}

// Export type for use in other files
export type QueryKey = typeof queryKeys

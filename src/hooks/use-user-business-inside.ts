// User Business Inside CRUD hooks with mobile-first optimizations
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { queryKeys } from '../lib/query-keys'

import { businessService } from '../services/business.service'

// User business inside hooks refactored to use service layer

// User Business Inside queries with mobile-first optimizations
export function useUserBusinessInside(id?: string) {
  return useQuery({
    queryKey: id
      ? queryKeys.businessInside.detail(id)
      : ['business-inside', 'detail', ''],
    queryFn: async () => {
      if (!id) return null
      return businessService.getUserBusinessInside(id)
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes for individual business
  })
}

export function useUserBusinessInsideListWithCount() {
  return useQuery({
    queryKey: queryKeys.businessInside.lists(),
    queryFn: async () => {
      const result = await businessService.getUserBusinessInsideList({
        isActive: true,
      })
      return { data: result.data, count: result.count }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes for business lists
  })
}

export function useUserBusinessInsideByProfile(profileId?: string) {
  return useQuery({
    queryKey: profileId
      ? queryKeys.businessInside.byProfile(profileId)
      : ['business-inside', 'profile', profileId],
    queryFn: async () => {
      if (!profileId) return []
      return businessService.getUserBusinessInsideByProfile(profileId)
    },
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000, // 5 minutes for profile businesses
  })
}

export function useCurrentUserBusinessInside() {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: userId
      ? queryKeys.businessInside.byProfile(userId)
      : ['business-inside', 'currentUser', userId],
    queryFn: async () => {
      if (!userId) return []
      return businessService.getUserBusinessInsideByProfile(userId)
    },
    enabled: !!userId,
    staleTime: 3 * 60 * 1000, // 3 minutes for current user businesses
  })
}

export function useSearchUserBusinessInside(searchQuery: string) {
  return useQuery({
    queryKey: queryKeys.businessInside.search(searchQuery),
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return []
      const result = await businessService.searchBusinesses(searchQuery)
      return result.inside
    },
    enabled: !!searchQuery && searchQuery.length >= 2,
    staleTime: 3 * 60 * 1000, // 3 minutes for search results
  })
}

export function useUserBusinessInsideByType(businessType?: string) {
  return useQuery({
    queryKey: businessType
      ? queryKeys.businessInside.byType(businessType)
      : ['business-inside', 'type', ''],
    queryFn: async () => {
      if (!businessType) return []
      const result = await businessService.getBusinessesByCategory(businessType)
      return result.inside
    },
    enabled: !!businessType,
    staleTime: 5 * 60 * 1000, // 5 minutes for type-based businesses
  })
}

// Specialized mutations for business inside operations

/**
 * Hook to get location assignment info for a business inside
 */
export function useBusinessInsideLocationAssignmentInfo(businessId: string) {
  return useQuery({
    queryKey: ['business-location-assignment', businessId],
    queryFn: async () => {
      return businessService.getBusinessInsideLocationAssignmentInfo(businessId)
    },
    enabled: !!businessId,
    staleTime: 5 * 60 * 1000, // 5 minutes for location assignment info
  })
}

// Bulk operations for admin functionality

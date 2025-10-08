// User Business Outside CRUD hooks with mobile-first optimizations
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { queryKeys } from '../lib/query-keys'

import { businessService } from '../services/business.service'

// User business outside hooks refactored to use service layer

// Specialized hooks for User Business Outside

export function useUserBusinessOutside(id?: string) {
  return useQuery({
    queryKey: queryKeys.businessOutside.detail(id || ''),
    queryFn: async () => {
      if (!id) return null
      return businessService.getUserBusinessOutside(id)
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes for individual business
  })
}

export function useUserBusinessOutsideByProfile(profileId?: string) {
  return useQuery({
    queryKey: queryKeys.businessOutside.byProfile(profileId || ''),
    queryFn: async () => {
      if (!profileId) return []
      return businessService.getUserBusinessOutsideByProfile(profileId)
    },
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000, // 5 minutes for profile businesses
  })
}

export function useCurrentUserBusinessOutside() {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: queryKeys.businessOutside.byProfile(userId || ''),
    queryFn: async () => {
      if (!userId) return []
      return businessService.getUserBusinessOutsideByProfile(userId)
    },
    enabled: !!userId,
    staleTime: 3 * 60 * 1000, // 3 minutes for current user businesses
  })
}

export function useSearchUserBusinessOutside(searchQuery: string) {
  return useQuery({
    queryKey: queryKeys.businessOutside.search(searchQuery),
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return []
      const result = await businessService.searchBusinesses(searchQuery)
      return result.outside
    },
    enabled: !!searchQuery && searchQuery.length >= 2,
    staleTime: 3 * 60 * 1000, // 3 minutes for search results
  })
}

export function useUserBusinessOutsideByType(businessType?: string) {
  return useQuery({
    queryKey: [...queryKeys.businessOutside.all, 'type', businessType],
    queryFn: async () => {
      if (!businessType) return []
      const result = await businessService.getBusinessesByCategory(businessType)
      return result.outside
    },
    enabled: !!businessType,
    staleTime: 5 * 60 * 1000, // 5 minutes for type-based businesses
  })
}

// Featured businesses for mobile home screen
export function useFeaturedUserBusinessOutside(limit = 10) {
  return useQuery({
    queryKey: [...queryKeys.businessOutside.featured(), limit],
    queryFn: async () => {
      return businessService.getFeaturedUserBusinessOutside(limit)
    },
    staleTime: 15 * 60 * 1000, // 15 minutes for featured businesses
  })
}

// Specialized mutations that extend the basic CRUD hooks

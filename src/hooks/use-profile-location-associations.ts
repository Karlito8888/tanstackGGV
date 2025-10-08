// Profile Location Associations UI hooks with mobile-first optimizations
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../lib/query-keys'
import { profileLocationAssociationService } from '../services/profile-location-association.service'

// Profile Location Association UI queries with mobile-first optimizations
// Note: Database operations are handled by triggers/functions - these hooks provide UI data only
export function useProfileLocationAssociationList(filters?: {
  profileId?: string
  locationId?: string
  isVerified?: boolean
  isOwner?: boolean
  limit?: number
  offset?: number
}) {
  return useQuery({
    queryKey: queryKeys.profileLocationAssociations.list(filters),
    queryFn: async () => {
      return profileLocationAssociationService.getAssociationsList(filters)
    },
    staleTime: 10 * 60 * 1000, // 10 minutes for filtered lists
  })
}

export function useProfileLocationAssociationById(id: number | undefined) {
  return useQuery({
    queryKey: queryKeys.profileLocationAssociations.detail(String(id || '')),
    queryFn: async () => {
      if (!id) throw new Error('ID is required')
      return profileLocationAssociationService.getAssociationWithDetails(id)
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes for detail view
  })
}

export function useProfileLocationAssociationsByProfile(profileId: string) {
  return useQuery({
    queryKey: queryKeys.profileLocationAssociations.byProfile(profileId),
    queryFn: async () => {
      return profileLocationAssociationService.getAssociationsByProfile(
        profileId,
      )
    },
    enabled: !!profileId,
    staleTime: 10 * 60 * 1000, // 10 minutes for profile associations
  })
}

export function useProfileLocationAssociationsByLocation(locationId: string) {
  return useQuery({
    queryKey: queryKeys.profileLocationAssociations.byLocation(locationId),
    queryFn: async () => {
      return profileLocationAssociationService.getAssociationsByLocation(
        locationId,
      )
    },
    enabled: !!locationId,
    staleTime: 10 * 60 * 1000, // 10 minutes for location associations
  })
}

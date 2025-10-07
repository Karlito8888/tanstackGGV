// Profile Location Associations UI hooks with mobile-first optimizations
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/query-keys'
import type { Row } from '../lib/database-types'

type ProfileLocationAssociation = Row<'profile_location_associations'>

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
      let query = supabase.from('profile_location_associations').select(
        `
          *,
          profiles (
            id,
            username,
            full_name,
            avatar_url
          ),
          locations (
            id,
            block,
            lot,
            coordinates,
            is_locked
          )
        `,
        { count: 'exact' },
      )

      // Apply filters
      if (filters?.profileId) {
        query = query.eq('profile_id', filters.profileId)
      }
      if (filters?.locationId) {
        query = query.eq('location_id', filters.locationId)
      }
      if (filters?.isVerified !== undefined) {
        query = query.eq('is_verified', filters.isVerified)
      }
      if (filters?.isOwner !== undefined) {
        query = query.eq('is_owner', filters.isOwner)
      }

      // Apply pagination
      if (filters?.limit) {
        query = query.limit(filters.limit)
      }
      if (filters?.offset) {
        query = query.range(
          filters.offset,
          filters.offset + (filters.limit || 10) - 1,
        )
      }

      // Order by profile_id, then location_id
      query = query
        .order('profile_id', { ascending: true })
        .order('location_id', { ascending: true })

      const { data, error, count } = await query
      if (error) throw error

      return { data, count }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes for filtered lists
  })
}

export function useProfileLocationAssociationById(id: number | undefined) {
  return useQuery({
    queryKey: queryKeys.profileLocationAssociations.detail(String(id || '')),
    queryFn: async () => {
      if (!id) throw new Error('ID is required')

      const { data, error } = await supabase
        .from('profile_location_associations')
        .select(
          `
          *,
          profiles (
            id,
            username,
            full_name,
            avatar_url
          ),
          locations (
            id,
            block,
            lot,
            coordinates,
            is_locked
          )
        `,
        )
        .eq('id', id)
        .single()

      if (error) throw error
      return data as ProfileLocationAssociation & {
        profiles: any
        locations: any
      }
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes for detail view
  })
}

export function useProfileLocationAssociationsByProfile(profileId: string) {
  return useQuery({
    queryKey: queryKeys.profileLocationAssociations.byProfile(profileId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_location_associations')
        .select(
          `
          *,
          locations (
            id,
            block,
            lot,
            coordinates,
            is_locked
          )
        `,
        )
        .eq('profile_id', profileId)

      if (error) throw error
      return data as Array<ProfileLocationAssociation & { locations: any }>
    },
    enabled: !!profileId,
    staleTime: 10 * 60 * 1000, // 10 minutes for profile associations
  })
}

export function useProfileLocationAssociationsByLocation(locationId: string) {
  return useQuery({
    queryKey: queryKeys.profileLocationAssociations.byLocation(locationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_location_associations')
        .select(
          `
          *,
          profiles (
            id,
            username,
            full_name,
            avatar_url
          )
        `,
        )
        .eq('location_id', locationId)

      if (error) throw error
      return data as Array<ProfileLocationAssociation & { profiles: any }>
    },
    enabled: !!locationId,
    staleTime: 10 * 60 * 1000, // 10 minutes for location associations
  })
}

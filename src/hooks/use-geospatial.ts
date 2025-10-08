// Geospatial utility hooks for map features
// Using TanStack Query best practices with mobile-first optimizations
import { useQuery } from '@tanstack/react-query'
import { geospatialService } from '../services/geospatial.service'

// Types for geospatial data
export interface LocationCoordinates {
  lat: number
  lng: number
}

export interface LocationWithCoords {
  id: string
  block: string
  lot: string
  lng: number
  lat: number
  is_locked: boolean
  marker_url: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface AssociatedLocationWithCoords extends LocationWithCoords {
  users: Array<{
    id: string
    name: string | null
    avatar_url: string | null
    is_owner: boolean
  }>
}

/**
 * Hook to get coordinates for a specific location
 * Uses the get_location_coordinates database function
 */
export function useLocationCoordinates(locationId?: string) {
  return useQuery({
    queryKey: locationId
      ? ['geospatial', 'location-coords', locationId]
      : ['geospatial', 'location-coords', ''],
    queryFn: async () => {
      if (!locationId) return null
      return geospatialService.getLocationCoordinates(locationId)
    },
    enabled: !!locationId,
    staleTime: 15 * 60 * 1000, // 15 minutes for location coordinates
  })
}

/**
 * Hook to get all locations with coordinates
 * Uses the get_locations_with_coords database function
 */
export function useLocationsWithCoords() {
  return useQuery({
    queryKey: ['geospatial', 'locations-with-coords'],
    queryFn: async () => {
      return geospatialService.getLocationsWithCoords()
    },
    staleTime: 10 * 60 * 1000, // 10 minutes for locations list
  })
}

/**
 * Hook to get associated locations with user information
 * Uses the get_associated_locations_with_coords database function
 */
export function useAssociatedLocationsWithCoords() {
  return useQuery({
    queryKey: ['geospatial', 'associated-locations-with-coords'],
    queryFn: async () => {
      return geospatialService.getAssociatedLocationsWithCoords()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes for associated locations (more dynamic)
  })
}

/**
 * Hook to get user's home location ID
 * Uses the get_user_home_location database function
 */
export function useUserHomeLocation(userId?: string) {
  return useQuery({
    queryKey: userId
      ? ['geospatial', 'user-home-location', userId]
      : ['geospatial', 'user-home-location', ''],
    queryFn: async () => {
      if (!userId) return null
      return geospatialService.getUserHomeLocation(userId)
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes for home location
  })
}

/**
 * Hook to get locations within a specific radius of a point
 * Client-side filtering using coordinates from useLocationsWithCoords
 */
export function useLocationsWithinRadius(
  centerLat: number,
  centerLng: number,
  radiusKm: number = 1,
) {
  const { data: locations, ...query } = useLocationsWithCoords()

  const filteredLocations = locations?.filter((location) => {
    if (!location.lat || !location.lng) return false

    // Haversine formula to calculate distance between two points
    const distance = calculateDistance(
      centerLat,
      centerLng,
      location.lat,
      location.lng,
    )

    return distance <= radiusKm
  })

  return {
    ...query,
    data: filteredLocations || [],
  }
}

/**
 * Hook to get nearby locations with user associations
 * Combines location coordinates with user associations for map display
 */
export function useNearbyAssociatedLocations(
  centerLat: number,
  centerLng: number,
  radiusKm: number = 1,
) {
  const { data: associatedLocations, ...query } =
    useAssociatedLocationsWithCoords()

  const filteredLocations = associatedLocations?.filter((location) => {
    if (!location.lat || !location.lng) return false

    const distance = calculateDistance(
      centerLat,
      centerLng,
      location.lat,
      location.lng,
    )

    return distance <= radiusKm
  })

  return {
    ...query,
    data: filteredLocations || [],
  }
}

/**
 * Hook to search locations by coordinates with user context
 * Useful for "find locations near me" functionality
 */
export function useSearchLocationsByCoords(
  userLat?: number,
  userLng?: number,
  maxDistanceKm: number = 5,
) {
  const { data: associatedLocations, ...query } =
    useAssociatedLocationsWithCoords()

  const locationsWithDistance = associatedLocations
    ?.map((location) => {
      if (!location.lat || !location.lng || !userLat || !userLng) {
        return { ...location, distance: null }
      }

      const distance = calculateDistance(
        userLat,
        userLng,
        location.lat,
        location.lng,
      )
      return { ...location, distance }
    })
    .filter(
      (location) =>
        location.distance !== null && location.distance <= maxDistanceKm,
    )
    .sort((a, b) => (a.distance || 0) - (b.distance || 0))

  return {
    ...query,
    data: locationsWithDistance || [],
  }
}

/**
 * Utility function to calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Utility function to convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Hook to get map bounds for a set of locations
 * Useful for auto-centering the map on visible locations
 */
export function useMapBounds(locations?: Array<{ lat: number; lng: number }>) {
  return useQuery({
    queryKey: [
      'geospatial',
      'map-bounds',
      locations?.map((l) => `${l.lat},${l.lng}`).join('|'),
    ],
    queryFn: () => {
      if (!locations || locations.length === 0) {
        return null
      }

      const lats = locations.map((l) => l.lat).filter(Boolean)
      const lngs = locations.map((l) => l.lng).filter(Boolean)

      if (lats.length === 0 || lngs.length === 0) {
        return null
      }

      const minLat = Math.min(...lats)
      const maxLat = Math.max(...lats)
      const minLng = Math.min(...lngs)
      const maxLng = Math.max(...lngs)

      // Add padding to bounds (10% of the range)
      const latPadding = (maxLat - minLat) * 0.1 || 0.01
      const lngPadding = (maxLng - minLng) * 0.1 || 0.01

      return {
        north: maxLat + latPadding,
        south: maxLat - latPadding,
        east: maxLng + lngPadding,
        west: minLng - lngPadding,
        center: {
          lat: (minLat + maxLat) / 2,
          lng: (minLng + maxLng) / 2,
        },
      }
    },
    enabled: !!locations && locations.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes for map bounds
  })
}

/**
 * Hook to get location clusters for map performance
 * Groups nearby locations together for better visualization at high zoom levels
 */
export function useLocationClusters(
  locations?: Array<{ lat: number; lng: number; id: string }>,
  clusterRadiusKm: number = 0.5,
) {
  return useQuery({
    queryKey: [
      'geospatial',
      'location-clusters',
      clusterRadiusKm,
      locations?.length,
    ],
    queryFn: () => {
      if (!locations || locations.length === 0) {
        return []
      }

      const clusters: Array<{
        center: { lat: number; lng: number }
        locations: Array<{ lat: number; lng: number; id: string }>
        count: number
      }> = []

      const processed = new Set<string>()

      locations.forEach((location) => {
        if (processed.has(location.id)) return

        const nearbyLocations = locations.filter((other) => {
          if (processed.has(other.id)) return false
          if (other.id === location.id) return true

          const distance = calculateDistance(
            location.lat,
            location.lng,
            other.lat,
            other.lng,
          )

          return distance <= clusterRadiusKm
        })

        if (nearbyLocations.length > 0) {
          const centerLat =
            nearbyLocations.reduce((sum, loc) => sum + loc.lat, 0) /
            nearbyLocations.length
          const centerLng =
            nearbyLocations.reduce((sum, loc) => sum + loc.lng, 0) /
            nearbyLocations.length

          clusters.push({
            center: { lat: centerLat, lng: centerLng },
            locations: nearbyLocations,
            count: nearbyLocations.length,
          })

          nearbyLocations.forEach((loc) => processed.add(loc.id))
        }
      })

      return clusters
    },
    enabled: !!locations && locations.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes for clusters
  })
}

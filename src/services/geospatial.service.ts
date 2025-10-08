/**
 * Geospatial Service
 *
 * Service layer for geospatial operations following the
 * Supabase Services & Hooks pattern.
 *
 * This service encapsulates:
 * - Location coordinate operations
 * - Geospatial queries and calculations
 * - Map-related functionality
 * - Distance calculations and clustering
 * - Type-safe operations with proper error handling
 */

import { BaseService } from './base.service'

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

export interface MapBounds {
  north: number
  south: number
  east: number
  west: number
  center: {
    lat: number
    lng: number
  }
}

export interface LocationCluster {
  center: { lat: number; lng: number }
  locations: Array<{ lat: number; lng: number; id: string }>
  count: number
}

export interface LocationWithDistance extends LocationWithCoords {
  distance: number
}

export class GeospatialService extends BaseService {
  // ==================== LOCATION COORDINATES ====================

  /**
   * Get coordinates for a specific location
   */
  async getLocationCoordinates(
    locationId: string,
  ): Promise<LocationCoordinates | null> {
    this.validateRequired(
      locationId,
      'locationId',
      'GeospatialService.getLocationCoordinates',
    )

    const response = await this.supabase.rpc('get_location_coordinates', {
      location_id: locationId,
    })

    if (response.error) {
      this.handleError(
        response.error,
        'GeospatialService.getLocationCoordinates',
      )
    }

    return response.data as LocationCoordinates | null
  }

  /**
   * Get all locations with coordinates
   */
  async getLocationsWithCoords(): Promise<Array<LocationWithCoords>> {
    const response = await this.supabase.rpc('get_locations_with_coords')

    if (response.error) {
      this.handleError(
        response.error,
        'GeospatialService.getLocationsWithCoords',
      )
    }

    return response.data as Array<LocationWithCoords>
  }

  /**
   * Get associated locations with user information
   */
  async getAssociatedLocationsWithCoords(): Promise<
    Array<AssociatedLocationWithCoords>
  > {
    const response = await this.supabase.rpc(
      'get_associated_locations_with_coords',
    )

    if (response.error) {
      this.handleError(
        response.error,
        'GeospatialService.getAssociatedLocationsWithCoords',
      )
    }

    return response.data as Array<AssociatedLocationWithCoords>
  }

  /**
   * Get user's home location ID
   */
  async getUserHomeLocation(userId: string): Promise<string | null> {
    this.validateRequired(
      userId,
      'userId',
      'GeospatialService.getUserHomeLocation',
    )

    const response = await this.supabase.rpc('get_user_home_location', {
      user_profile_id: userId,
    })

    if (response.error) {
      this.handleError(response.error, 'GeospatialService.getUserHomeLocation')
    }

    return response.data as string | null
  }

  // ==================== DISTANCE AND PROXIMITY ====================

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371 // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1)
    const dLng = this.toRadians(lng2 - lng1)

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  /**
   * Get locations within a specific radius of a point
   */
  async getLocationsWithinRadius(
    centerLat: number,
    centerLng: number,
    radiusKm: number = 1,
  ): Promise<Array<LocationWithCoords>> {
    const locations = await this.getLocationsWithCoords()

    return locations.filter((location) => {
      if (!location.lat || !location.lng) return false

      const distance = this.calculateDistance(
        centerLat,
        centerLng,
        location.lat,
        location.lng,
      )

      return distance <= radiusKm
    })
  }

  /**
   * Get associated locations within a specific radius
   */
  async getAssociatedLocationsWithinRadius(
    centerLat: number,
    centerLng: number,
    radiusKm: number = 1,
  ): Promise<Array<AssociatedLocationWithCoords>> {
    const locations = await this.getAssociatedLocationsWithCoords()

    return locations.filter((location) => {
      if (!location.lat || !location.lng) return false

      const distance = this.calculateDistance(
        centerLat,
        centerLng,
        location.lat,
        location.lng,
      )

      return distance <= radiusKm
    })
  }

  /**
   * Search locations by coordinates with user context
   */
  async searchLocationsByCoords(
    userLat: number,
    userLng: number,
    maxDistanceKm: number = 5,
  ): Promise<Array<AssociatedLocationWithCoords & { distance: number }>> {
    const locations = await this.getAssociatedLocationsWithCoords()

    const locationsWithDistance = locations
      .map((location) => {
        if (!location.lat || !location.lng) {
          return null
        }

        const distance = this.calculateDistance(
          userLat,
          userLng,
          location.lat,
          location.lng,
        )
        return { ...location, distance }
      })
      .filter(
        (
          location,
        ): location is AssociatedLocationWithCoords & { distance: number } =>
          location !== null && location.distance <= maxDistanceKm,
      )
      .sort((a, b) => a.distance - b.distance)

    return locationsWithDistance
  }

  // ==================== MAP BOUNDS AND VIEWPORT ====================

  /**
   * Calculate map bounds for a set of locations
   */
  calculateMapBounds(
    locations: Array<{ lat: number; lng: number }>,
  ): MapBounds | null {
    if (locations.length === 0) {
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
      south: minLat - latPadding,
      east: maxLng + lngPadding,
      west: minLng - lngPadding,
      center: {
        lat: (minLat + maxLat) / 2,
        lng: (minLng + maxLng) / 2,
      },
    }
  }

  /**
   * Get optimal map bounds for user's associated locations
   */
  async getUserAssociatedLocationsBounds(
    userId: string,
  ): Promise<MapBounds | null> {
    this.validateRequired(
      userId,
      'userId',
      'GeospatialService.getUserAssociatedLocationsBounds',
    )

    // Get user's associated locations
    const locations = await this.getAssociatedLocationsWithCoords()

    // Filter for locations associated with this user
    const userLocations = locations.filter((location) =>
      location.users.some((user) => user.id === userId),
    )

    if (userLocations.length === 0) {
      return null
    }

    return this.calculateMapBounds(userLocations)
  }

  // ==================== LOCATION CLUSTERING ====================

  /**
   * Create location clusters for map performance
   */
  calculateLocationClusters(
    locations: Array<{ lat: number; lng: number; id: string }>,
    clusterRadiusKm: number = 0.5,
  ): Array<LocationCluster> {
    if (locations.length === 0) {
      return []
    }

    const clusters: Array<LocationCluster> = []
    const processed = new Set<string>()

    locations.forEach((location) => {
      if (processed.has(location.id)) return

      const nearbyLocations = locations.filter((other) => {
        if (processed.has(other.id)) return false
        if (other.id === location.id) return true

        const distance = this.calculateDistance(
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
  }

  /**
   * Get location clusters for associated locations
   */
  async getAssociatedLocationClusters(
    clusterRadiusKm: number = 0.5,
  ): Promise<Array<LocationCluster>> {
    const locations = await this.getAssociatedLocationsWithCoords()

    return this.calculateLocationClusters(locations, clusterRadiusKm)
  }

  // ==================== GEOSPATIAL SEARCH AND FILTERING ====================

  /**
   * Find nearest locations to a point
   */
  async findNearestLocations(
    centerLat: number,
    centerLng: number,
    limit: number = 10,
  ): Promise<Array<LocationWithCoords & { distance: number }>> {
    const locations = await this.getLocationsWithCoords()

    const locationsWithDistance = locations
      .map((location) => {
        if (!location.lat || !location.lng) {
          return { ...location, distance: Infinity }
        }

        const distance = this.calculateDistance(
          centerLat,
          centerLng,
          location.lat,
          location.lng,
        )

        return { ...location, distance }
      })
      .filter((location) => location.distance !== Infinity)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit)

    return locationsWithDistance
  }

  /**
   * Get locations within bounding box
   */
  async getLocationsInBoundingBox(
    north: number,
    south: number,
    east: number,
    west: number,
  ): Promise<Array<LocationWithCoords>> {
    const locations = await this.getLocationsWithCoords()

    return locations.filter((location) => {
      if (!location.lat || !location.lng) return false

      return (
        location.lat >= south &&
        location.lat <= north &&
        location.lng >= west &&
        location.lng <= east
      )
    })
  }

  /**
   * Get associated locations within bounding box
   */
  async getAssociatedLocationsInBoundingBox(
    north: number,
    south: number,
    east: number,
    west: number,
  ): Promise<Array<AssociatedLocationWithCoords>> {
    const locations = await this.getAssociatedLocationsWithCoords()

    return locations.filter((location) => {
      if (!location.lat || !location.lng) return false

      return (
        location.lat >= south &&
        location.lat <= north &&
        location.lng >= west &&
        location.lng <= east
      )
    })
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Validate coordinates
   */
  validateCoordinates(lat: number, lng: number): boolean {
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180 &&
      !isNaN(lat) &&
      !isNaN(lng)
    )
  }

  /**
   * Format coordinates for display
   */
  formatCoordinates(lat: number, lng: number, precision: number = 6): string {
    return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`
  }

  /**
   * Calculate bearing between two points
   */
  calculateBearing(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
  ): number {
    const startLatRad = this.toRadians(startLat)
    const endLatRad = this.toRadians(endLat)
    const deltaLngRad = this.toRadians(endLng - startLng)

    const y = Math.sin(deltaLngRad) * Math.cos(endLatRad)
    const x =
      Math.cos(startLatRad) * Math.sin(endLatRad) -
      Math.sin(startLatRad) * Math.cos(endLatRad) * Math.cos(deltaLngRad)

    const bearingRad = Math.atan2(y, x)
    const bearingDeg = this.toDegrees(bearingRad)

    return (bearingDeg + 360) % 360
  }

  /**
   * Convert radians to degrees
   */
  private toDegrees(radians: number): number {
    return radians * (180 / Math.PI)
  }

  /**
   * Get cardinal direction from bearing
   */
  getCardinalDirection(bearing: number): string {
    const directions = [
      'N',
      'NNE',
      'NE',
      'ENE',
      'E',
      'ESE',
      'SE',
      'SSE',
      'S',
      'SSW',
      'SW',
      'WSW',
      'W',
      'WNW',
      'NW',
      'NNW',
    ]
    const index = Math.round(bearing / 22.5) % 16
    return directions[index]
  }
}

// Export singleton instance - reused throughout the application
export const geospatialService = new GeospatialService()

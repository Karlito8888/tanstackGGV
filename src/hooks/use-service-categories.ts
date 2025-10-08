// Service Categories CRUD hooks with mobile-first optimizations
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../lib/query-keys'

import { serviceCategoryService } from '../services/service-category.service'

// Service categories hooks refactored to use service layer

// Service Categories queries with mobile-first optimizations
export function useServiceCategories(id?: string) {
  return useQuery({
    queryKey: id
      ? queryKeys.serviceCategories.detail(id)
      : ['service-categories', 'detail', ''],
    queryFn: async () => {
      if (!id) return null
      return serviceCategoryService.getServiceCategory(id)
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes for individual category
  })
}

export function useServiceCategoriesListWithCount() {
  return useQuery({
    queryKey: queryKeys.serviceCategories.lists(),
    queryFn: async () => {
      const result = await serviceCategoryService.getServiceCategoriesList({
        isActive: true,
      })
      return { data: result.data, count: result.count }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes for categories lists
  })
}

export function useActiveServiceCategories() {
  return useQuery({
    queryKey: queryKeys.serviceCategories.active(),
    queryFn: async () => {
      return serviceCategoryService.getActiveServiceCategories()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes for active categories
  })
}

export function useSearchServiceCategories(searchQuery: string) {
  return useQuery({
    queryKey: queryKeys.serviceCategories.search(searchQuery),
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return []
      return serviceCategoryService.searchServiceCategories(searchQuery)
    },
    enabled: !!searchQuery && searchQuery.length >= 2,
    staleTime: 3 * 60 * 1000, // 3 minutes for search results
  })
}

// Note: Admin operations (update, delete, bulk operations) are handled directly in Supabase
// Users can only read and create categories

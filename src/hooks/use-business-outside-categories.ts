// Business Outside Categories CRUD hooks with mobile-first optimizations
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/query-keys'
import { handleMutationError } from '../lib/crud/error-handling'
import { businessCategoryService } from '../services/business-category.service'
import type { InsertRow } from '../lib/database-types'

type BusinessOutsideCategoryInsert = InsertRow<'business_outside_categories'>

// Business Outside Categories queries with mobile-first optimizations
export function useBusinessOutsideCategories(id?: string) {
  return useQuery({
    queryKey: queryKeys.businessOutsideCategories.detail(id || ''),
    queryFn: () => businessCategoryService.getBusinessOutsideCategory(id!),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes for individual category
  })
}

export function useBusinessOutsideCategoriesListWithCount() {
  return useQuery({
    queryKey: queryKeys.businessOutsideCategories.lists(),
    queryFn: () =>
      businessCategoryService.getBusinessOutsideCategoriesList({
        isActive: true,
      }),
    staleTime: 5 * 60 * 1000, // 5 minutes for categories lists
  })
}

export function useActiveBusinessOutsideCategories() {
  return useQuery({
    queryKey: queryKeys.businessOutsideCategories.active(),
    queryFn: () => businessCategoryService.getActiveBusinessOutsideCategories(),
    staleTime: 5 * 60 * 1000, // 5 minutes for active categories
  })
}

export function useSearchBusinessOutsideCategories(searchQuery: string) {
  return useQuery({
    queryKey: queryKeys.businessOutsideCategories.search(searchQuery),
    queryFn: () =>
      businessCategoryService.searchBusinessOutsideCategories(searchQuery),
    enabled: !!searchQuery && searchQuery.length >= 2,
    staleTime: 3 * 60 * 1000, // 3 minutes for search results
  })
}

// Create mutation for business outside categories
export function useCreateBusinessOutsideCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (category: BusinessOutsideCategoryInsert) =>
      businessCategoryService.createBusinessOutsideCategory(category),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.businessOutsideCategories.lists(),
      })
    },
    onError: (error) => handleMutationError(error, 'create'),
  })
}

// Note: Admin operations (update, delete, bulk operations) are handled directly in Supabase
// Users can only read and create categories

// Business Inside Categories CRUD hooks with mobile-first optimizations
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/query-keys'
import { handleMutationError } from '../lib/crud/error-handling'
import { businessCategoryService } from '../services/business-category.service'
import type { InsertRow } from '../lib/database-types'

type BusinessInsideCategoryInsert = InsertRow<'business_inside_categories'>

// Business Inside Categories queries with mobile-first optimizations
export function useBusinessInsideCategories(id?: string) {
  return useQuery({
    queryKey: queryKeys.businessInsideCategories.detail(id || ''),
    queryFn: () => businessCategoryService.getBusinessInsideCategory(id!),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes for individual category
  })
}

export function useBusinessInsideCategoriesListWithCount() {
  return useQuery({
    queryKey: queryKeys.businessInsideCategories.lists(),
    queryFn: () =>
      businessCategoryService.getBusinessInsideCategoriesList({
        isActive: true,
      }),
    staleTime: 5 * 60 * 1000, // 5 minutes for categories lists
  })
}

export function useActiveBusinessInsideCategories() {
  return useQuery({
    queryKey: queryKeys.businessInsideCategories.active(),
    queryFn: () => businessCategoryService.getActiveBusinessInsideCategories(),
    staleTime: 5 * 60 * 1000, // 5 minutes for active categories
  })
}

export function useSearchBusinessInsideCategories(searchQuery: string) {
  return useQuery({
    queryKey: queryKeys.businessInsideCategories.search(searchQuery),
    queryFn: () =>
      businessCategoryService.searchBusinessInsideCategories(searchQuery),
    enabled: !!searchQuery && searchQuery.length >= 2,
    staleTime: 3 * 60 * 1000, // 3 minutes for search results
  })
}

// Create mutation for business inside categories
export function useCreateBusinessInsideCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (category: BusinessInsideCategoryInsert) =>
      businessCategoryService.createBusinessInsideCategory(category),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.businessInsideCategories.lists(),
      })
    },
    onError: (error) => handleMutationError(error, 'create'),
  })
}

// Note: Admin operations (update, delete, bulk operations) are handled directly in Supabase
// Users can only read and create categories

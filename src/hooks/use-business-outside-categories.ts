// Business Outside Categories CRUD hooks with mobile-first optimizations
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/query-keys'
import { createCRUDHooks } from '../lib/crud/create-crud-hooks'
import type { Row } from '../lib/database-types'

type BusinessOutsideCategories = Row<'business_outside_categories'>

// Create CRUD hooks for business_outside_categories table
const businessOutsideCategoriesHooks =
  createCRUDHooks<'business_outside_categories'>({
    tableName: 'business_outside_categories',
    queryKeys: {
      all: queryKeys.businessOutsideCategories.all,
      lists: () => queryKeys.businessOutsideCategories.lists(),
      list: (filters?: any) =>
        queryKeys.businessOutsideCategories.list(filters),
      details: () => queryKeys.businessOutsideCategories.details(),
      detail: (id: string) => queryKeys.businessOutsideCategories.detail(id),
    },
  })

// Export basic CRUD hooks (users can only read and create)
export const useBusinessOutsideCategoriesList =
  businessOutsideCategoriesHooks.useList
export const useBusinessOutsideCategoriesById =
  businessOutsideCategoriesHooks.useById
export const useCreateBusinessOutsideCategories =
  businessOutsideCategoriesHooks.useCreate

// Business Outside Categories queries with mobile-first optimizations
export function useBusinessOutsideCategories(id?: string) {
  return useQuery({
    queryKey: id
      ? queryKeys.businessOutsideCategories.detail(id)
      : ['business-outside-categories', 'detail', ''],
    queryFn: async () => {
      if (!id) return null

      const { data, error } = await supabase
        .from('business_outside_categories')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes for individual category
  })
}

export function useBusinessOutsideCategoriesListWithCount() {
  return useQuery({
    queryKey: queryKeys.businessOutsideCategories.lists(),
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('business_outside_categories')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error

      return { data, count }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes for categories lists
  })
}

export function useActiveBusinessOutsideCategories() {
  return useQuery({
    queryKey: queryKeys.businessOutsideCategories.active(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_outside_categories')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error
      return data as Array<BusinessOutsideCategories>
    },
    staleTime: 5 * 60 * 1000, // 5 minutes for active categories
  })
}

export function useSearchBusinessOutsideCategories(searchQuery: string) {
  return useQuery({
    queryKey: queryKeys.businessOutsideCategories.search(searchQuery),
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return []

      const { data, error } = await supabase
        .from('business_outside_categories')
        .select('*')
        .eq('is_active', true)
        .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        .order('name', { ascending: true })
        .limit(50) // Limit search results

      if (error) throw error
      return data as Array<BusinessOutsideCategories>
    },
    enabled: !!searchQuery && searchQuery.length >= 2,
    staleTime: 3 * 60 * 1000, // 3 minutes for search results
  })
}

// Note: Admin operations (update, delete, bulk operations) are handled directly in Supabase
// Users can only read and create categories

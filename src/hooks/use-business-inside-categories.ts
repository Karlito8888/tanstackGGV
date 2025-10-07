// Business Inside Categories CRUD hooks with mobile-first optimizations
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/query-keys'
import { createCRUDHooks } from '../lib/crud/create-crud-hooks'
import type { Row } from '../lib/database-types'

type BusinessInsideCategories = Row<'business_inside_categories'>

// Create CRUD hooks for business_inside_categories table
const businessInsideCategoriesHooks =
  createCRUDHooks<'business_inside_categories'>({
    tableName: 'business_inside_categories',
    queryKeys: {
      all: queryKeys.businessInsideCategories.all,
      lists: () => queryKeys.businessInsideCategories.lists(),
      list: (filters?: any) => queryKeys.businessInsideCategories.list(filters),
      details: () => queryKeys.businessInsideCategories.details(),
      detail: (id: string) => queryKeys.businessInsideCategories.detail(id),
    },
  })

// Export basic CRUD hooks (users can only read and create)
export const useBusinessInsideCategoriesList =
  businessInsideCategoriesHooks.useList
export const useBusinessInsideCategoriesById =
  businessInsideCategoriesHooks.useById
export const useCreateBusinessInsideCategories =
  businessInsideCategoriesHooks.useCreate

// Business Inside Categories queries with mobile-first optimizations
export function useBusinessInsideCategories(id?: string) {
  return useQuery({
    queryKey: id
      ? queryKeys.businessInsideCategories.detail(id)
      : ['business-inside-categories', 'detail', ''],
    queryFn: async () => {
      if (!id) return null

      const { data, error } = await supabase
        .from('business_inside_categories')
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

export function useBusinessInsideCategoriesListWithCount() {
  return useQuery({
    queryKey: queryKeys.businessInsideCategories.lists(),
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('business_inside_categories')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error

      return { data, count }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes for categories lists
  })
}

export function useActiveBusinessInsideCategories() {
  return useQuery({
    queryKey: queryKeys.businessInsideCategories.active(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_inside_categories')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error
      return data as Array<BusinessInsideCategories>
    },
    staleTime: 5 * 60 * 1000, // 5 minutes for active categories
  })
}

export function useSearchBusinessInsideCategories(searchQuery: string) {
  return useQuery({
    queryKey: queryKeys.businessInsideCategories.search(searchQuery),
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return []

      const { data, error } = await supabase
        .from('business_inside_categories')
        .select('*')
        .eq('is_active', true)
        .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        .order('name', { ascending: true })
        .limit(50) // Limit search results

      if (error) throw error
      return data as Array<BusinessInsideCategories>
    },
    enabled: !!searchQuery && searchQuery.length >= 2,
    staleTime: 3 * 60 * 1000, // 3 minutes for search results
  })
}

// Note: Admin operations (update, delete, bulk operations) are handled directly in Supabase
// Users can only read and create categories

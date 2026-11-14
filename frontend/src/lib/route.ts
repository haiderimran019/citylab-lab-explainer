// Tiny hash router: '#/p/P004' (stored report), '#/custom' (pasted report), '' (home).
import { useEffect, useState } from 'react'

export type Route = { kind: 'home' } | { kind: 'patient'; id: string } | { kind: 'custom' }

function parse(hash: string): Route {
  const match = hash.match(/^#\/p\/([\w-]+)$/)
  if (match) return { kind: 'patient', id: match[1].toUpperCase() }
  if (hash === '#/custom') return { kind: 'custom' }
  return { kind: 'home' }
}

export function routeHash(route: Route): string {
  if (route.kind === 'patient') return `#/p/${route.id}`
  if (route.kind === 'custom') return '#/custom'
  return '#/'
}

export function navigate(route: Route): void {
  const hash = routeHash(route)
  if (window.location.hash !== hash) window.location.hash = hash
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

import { NextRequest, NextResponse } from 'next/server'
import { generateBreadcrumbs } from '@/lib/breadcrumbs'

export async function POST(request: NextRequest) {
  try {
    const { pathname } = await request.json()
    
    if (!pathname) {
      return NextResponse.json({ error: 'Pathname is required' }, { status: 400 })
    }

    const breadcrumbs = await generateBreadcrumbs(pathname)
    
    return NextResponse.json({ breadcrumbs })
  } catch (error) {
    console.error('Error generating breadcrumbs:', error)
    return NextResponse.json({ error: 'Failed to generate breadcrumbs' }, { status: 500 })
  }
} 
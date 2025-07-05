import { notFound } from "next/navigation";
import prisma from "./prisma";

export interface BreadcrumbItem {
  label: string;
  href: string;
  current?: boolean;
}

export async function generateBreadcrumbs(pathname: string): Promise<BreadcrumbItem[]> {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  // Always start with Home
  breadcrumbs.push({
    label: 'Dashboard',
    href: '/',
  });

  // Build breadcrumbs based on path segments
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const isLast = i === segments.length - 1;
    const currentPath = '/' + segments.slice(0, i + 1).join('/');

    switch (segment) {
      case 'laps':
        breadcrumbs.push({
          label: 'Laps',
          href: '/laps',
          current: isLast,
        });
        break;

      case 'all':
        if (segments[i - 1] === 'laps') {
          breadcrumbs.push({
            label: 'All Laps',
            href: '/laps/all',
            current: isLast,
          });
        }
        break;

      case 'cars':
        if (segments[i - 1] === 'laps') {
          breadcrumbs.push({
            label: 'Cars',
            href: '/laps/cars',
            current: isLast,
          });
        }
        break;

      case 'tracks':
        if (segments[i - 1] === 'laps') {
          breadcrumbs.push({
            label: 'Tracks',
            href: '/laps/tracks',
            current: isLast,
          });
        }
        break;

      case 'categories':
        if (segments[i - 1] === 'laps') {
          breadcrumbs.push({
            label: 'Categories',
            href: '/laps/categories',
            current: isLast,
          });
        }
        break;

      case 'analyze':
        breadcrumbs.push({
          label: 'Analyze',
          href: '/analyze',
          current: isLast,
        });
        break;

      default:
        // Handle dynamic segments
        const prevSegment = segments[i - 1];
        
        if (prevSegment === 'cars' && segments[i - 2] === 'laps') {
          // Dynamic car page
          if (segment && !isNaN(parseInt(segment))) {
            try {
              const vehicle = await prisma.vehicles.findUnique({
                where: { id: parseInt(segment) },
                select: { vehicle_name: true }
              });
              
              if (vehicle && vehicle.vehicle_name) {
                breadcrumbs.push({
                  label: vehicle.vehicle_name,
                  href: currentPath,
                  current: isLast,
                });
              } else {
                breadcrumbs.push({
                  label: 'Unknown Vehicle',
                  href: currentPath,
                  current: isLast,
                });
              }
            } catch (error) {
              breadcrumbs.push({
                label: 'Unknown Vehicle',
                href: currentPath,
                current: isLast,
              });
            }
          }
        } else if (prevSegment === 'tracks' && segments[i - 2] === 'laps') {
          // Dynamic track page - decode the track name from URL
          if (segment) {
            try {
              const decodedTrackName = decodeURIComponent(segment);
              const track = await prisma.sessions.findFirst({
                where: { track_name: decodedTrackName },
                select: { track_name: true }
              });
              
              if (track && track.track_name) {
                breadcrumbs.push({
                  label: track.track_name,
                  href: currentPath,
                  current: isLast,
                });
              } else {
                breadcrumbs.push({
                  label: decodedTrackName,
                  href: currentPath,
                  current: isLast,
                });
              }
            } catch (error) {
              breadcrumbs.push({
                label: 'Unknown Track',
                href: currentPath,
                current: isLast,
              });
            }
          }
        } else if (prevSegment === 'categories' && segments[i - 2] === 'laps') {
          // Dynamic category page - decode the category name from URL
          if (segment) {
            try {
              const decodedCategoryName = decodeURIComponent(segment);
              const category = await prisma.vehicles.findFirst({
                where: { class_name: decodedCategoryName },
                select: { class_name: true }
              });
              
              if (category && category.class_name) {
                breadcrumbs.push({
                  label: category.class_name,
                  href: currentPath,
                  current: isLast,
                });
              } else {
                breadcrumbs.push({
                  label: decodedCategoryName,
                  href: currentPath,
                  current: isLast,
                });
              }
            } catch (error) {
              breadcrumbs.push({
                label: 'Unknown Category',
                href: currentPath,
                current: isLast,
              });
            }
          }
        } else if (prevSegment === 'laps' && segments[i - 2] === 'analyze') {
          // Dynamic lap analysis page
          if (segment && !isNaN(parseInt(segment))) {
            try {
              const lap = await prisma.laps.findUnique({
                where: { id: parseInt(segment) },
                include: {
                  sessions: { select: { track_name: true } },
                  vehicles: { select: { vehicle_name: true } }
                }
              });
              
              if (lap) {
                const trackName = lap.sessions?.track_name || 'Unknown Track';
                const vehicleName = lap.vehicles?.vehicle_name || 'Unknown Vehicle';
                const lapLabel = `${trackName} - ${vehicleName}`;
                breadcrumbs.push({
                  label: lapLabel,
                  href: currentPath,
                  current: isLast,
                });
              } else {
                breadcrumbs.push({
                  label: 'Unknown Lap',
                  href: currentPath,
                  current: isLast,
                });
              }
            } catch (error) {
              breadcrumbs.push({
                label: 'Unknown Lap',
                href: currentPath,
                current: isLast,
              });
            }
          }
        } else if (segment) {
          // Generic fallback
          breadcrumbs.push({
            label: segment.charAt(0).toUpperCase() + segment.slice(1),
            href: currentPath,
            current: isLast,
          });
        }
        break;
    }
  }

  return breadcrumbs;
} 
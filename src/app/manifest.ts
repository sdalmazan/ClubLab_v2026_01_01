import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ClubLab - High Performance Sports Ecosystem',
    short_name: 'ClubLab',
    description: 'Plataforma de alto rendimiento deportivo, gestión de plantilla, entrenamientos y fisioterapia.',
    start_url: '/',
    display: 'standalone',
    background_color: '#090d16',
    theme_color: '#090d16',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  }
}

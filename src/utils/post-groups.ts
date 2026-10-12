export type PostGroupId = 'ia' | 'cloudflare' | 'academia' | 'proyectos' | 'herramientas' | 'charlas' | 'otros';

export interface PostGroup {
  id: PostGroupId;
  label: string;
  tone: 'green' | 'blue' | 'amber' | 'gray';
}

const groups: Record<PostGroupId, PostGroup> = {
  ia: { id: 'ia', label: 'IA', tone: 'green' },
  cloudflare: { id: 'cloudflare', label: 'Cloudflare', tone: 'blue' },
  academia: { id: 'academia', label: 'Academia', tone: 'amber' },
  proyectos: { id: 'proyectos', label: 'Proyectos', tone: 'gray' },
  herramientas: { id: 'herramientas', label: 'Herramientas', tone: 'blue' },
  charlas: { id: 'charlas', label: 'Charlas', tone: 'amber' },
  otros: { id: 'otros', label: 'Otros', tone: 'gray' },
};

/** Family used by the blog filter tabs. The row still shows the original category title. */
export function postGroup(category?: { slug?: string; title?: string }): PostGroup {
  const slug = (category?.slug || '').toLowerCase();
  const title = (category?.title || '').toLowerCase();
  const haystack = `${slug} ${title}`;

  if (slug === 'proyectos') return groups.proyectos;
  if (slug === 'herramientas') return groups.herramientas;
  if (slug === 'charlas' || slug === 'conference') return groups.charlas;
  if (haystack.includes('cloudflare')) return groups.cloudflare;
  if (haystack.includes('academia') || haystack.includes('conference')) return groups.academia;
  if (
    haystack.includes('ai') ||
    haystack.includes('ia') ||
    haystack.includes('generative') ||
    haystack.includes('vibe') ||
    haystack.includes('workplace')
  ) {
    return groups.ia;
  }
  return groups.otros;
}

export const postGroupOrder: PostGroupId[] = [
  'ia',
  'cloudflare',
  'academia',
  'proyectos',
  'herramientas',
  'charlas',
  'otros',
];

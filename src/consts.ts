import type { IconMap, SocialLink, Site } from '@/types'

export const SITE: Site = {
  title: 'Chara\'s Blog',
  description:
    'A blog about my journey, CTF, and my projects!',
  href: 'https://chara.dev',
  author: 'Chara',
  locale: 'en-US',
  featuredPostCount: 2,
  postsPerPage: 5,
}

export const NAV_LINKS: SocialLink[] = [
  {
    href: '/blog',
    label: 'blog',
  },
  // {
  //   href: '/authors',
  //   label: 'authors',
  // },
  {
    href: '/about',
    label: 'about',
  },
]

export const SOCIAL_LINKS: SocialLink[] = [
  {
    href: 'https://github.com/chara-0x',
    label: 'GitHub',
  },
  {
    href: 'https://twitter.com/chara0x00',
    label: 'Twitter',
  },
  {
    href: 'mailto:chara@chara.dev',
    label: 'Email',
  },
  {
    href: '/rss.xml',
    label: 'RSS',
  },
]

export const ICON_MAP: IconMap = {
  Website: 'lucide:globe',
  GitHub: 'lucide:github',
  LinkedIn: 'lucide:linkedin',
  Twitter: 'lucide:twitter',
  Email: 'lucide:mail',
  RSS: 'lucide:rss',
}

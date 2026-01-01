export type Site = {
  title: string
  description: string
  href: string
  author: string
  locale: string
  featuredPostCount: number
  postsPerPage: number
  DESCRIPTION?: string
  AUTHOR?: string
  NUM_POSTS_ON_HOMEPAGE?: number
}

export type SocialLink = {
  href: string
  label: string
  username?: string
}

export type IconMap = {
  [key: string]: string
}

export const profileConfig = {
  path: '/profiles',
  singularLabel: 'Profile',
  pluralLabel: 'Profiles',
  emptyState: '还没有任何 Profile，先创建一个新的 Profile。'
} as const;

export function buildProfileEditPath(profileId: string) {
  return `${profileConfig.path}/${profileId}/edit`;
}

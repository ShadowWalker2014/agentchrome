// What changes between macOS, Windows and Linux: the terminal, the file
// manager, the keys and the folder path. Everything else is Chrome.

export type OS = 'mac' | 'win' | 'linux'

export interface OSInfo {
  id: OS
  label: string
  /** The command shown typed in the terminal (the page shows the real one). */
  command: string
  termTitle: string
  prompt: string
  /** act.key combos */
  paste: string
  enter: string
  filesTitle: string
  folderPath: string
  /** Where the folder lives, as the file manager's sidebar names it */
  side: string[]
}

export const OSES: Record<OS, OSInfo> = {
  mac: {
    id: 'mac',
    label: 'macOS',
    command: 'curl -fsSL agentchrome.dev/install | sh',
    termTitle: 'Terminal — zsh',
    prompt: '~ %',
    paste: 'cmd+v',
    enter: 'return',
    filesTitle: 'Documents',
    folderPath: '~/Documents/Agent Chrome',
    side: ['Desktop', 'Documents', 'Downloads'],
  },
  win: {
    id: 'win',
    label: 'Windows',
    command: 'irm agentchrome.dev/install.ps1 | iex',
    termTitle: 'Windows PowerShell',
    prompt: 'PS C:\\Users\\you>',
    paste: 'pcctrl+v',
    enter: 'pcenter',
    filesTitle: 'Documents',
    folderPath: 'Documents\\Agent Chrome',
    side: ['Desktop', 'Documents', 'Downloads'],
  },
  linux: {
    id: 'linux',
    label: 'Linux',
    command: 'curl -fsSL agentchrome.dev/install | sh',
    termTitle: 'you@pc: ~',
    prompt: 'you@pc:~$',
    paste: 'pcctrl+pcshift+v',
    enter: 'pcenter',
    filesTitle: 'Documents',
    folderPath: '~/Documents/Agent Chrome',
    side: ['Home', 'Documents', 'Downloads'],
  },
}

export const CODE = 'H4KQ9-TZ27M'

export function detectOS(): OS {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  const p = (nav.userAgentData?.platform || nav.platform || '').toLowerCase()
  const ua = navigator.userAgent.toLowerCase()
  if (p.includes('win') || ua.includes('windows')) return 'win'
  if (p.includes('mac') || ua.includes('mac os') || ua.includes('iphone') || ua.includes('ipad')) return 'mac'
  if (p.includes('linux') || ua.includes('linux') || ua.includes('cros')) return ua.includes('android') ? 'mac' : 'linux'
  return 'mac'
}

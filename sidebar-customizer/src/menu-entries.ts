import { labels } from '@spicetify-ext/core';

export interface MenuEntry {
  name: string;
  pref: 'friendActivity' | 'whatsNew' | 'queue' | 'connect' | 'nowPlaying' | 'albumArtHandler';
}

export function menuEntries(): MenuEntry[] {
  return [
    { name: labels.listeningActivity(), pref: 'friendActivity' },
    { name: labels.whatsNew(), pref: 'whatsNew' },
    { name: labels.queue(), pref: 'queue' },
    { name: labels.connect(), pref: 'connect' },
    { name: labels.nowPlayingView(), pref: 'nowPlaying' },
    { name: 'Album Art Handler', pref: 'albumArtHandler' },
  ];
}

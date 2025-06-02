# Spicetify YT-Video

Spicetify YT-Video is a Spicetify extension that adds a YouTube button to the player, allowing you to watch music videos for Spotify tracks without ads, cookies, or tracking.

## How it works

- Adds a YouTube button next to the track info in the Spotify player.
- Adds a "Play video" item to the track's, album's, and artist's context menu.
- When clicked (or invoked via shortcut), it opens an overlay within Spotify showing YouTube search results based on the track's artist and name.
- You can browse through search results and click any video to watch it in the ad-free player.
- Videos play directly in the overlay using the embed player for enhanced privacy.
- Navigate through search results or played videos with back and forward buttons.
- If a video has embedding restrictions, you can open it directly on YouTube via a button in the search bar.
- Settings allow toggling API key usage, showing/hiding thumbnails, and autoplay.
- A help button ("?") in the search bar displays available keyboard shortcuts.

## Keyboard Shortcuts

The following keyboard shortcuts are available when the extension is active:

-   **Ctrl/Cmd + Y**: Open the YouTube search panel for the current track.
-   **ESC**:
    -   Close the keyboard shortcuts help overlay (if visible).
    -   Otherwise, close the main search panel or video player.
-   **Alt/Option + Left Arrow**: Navigate to the previous video in the search results (when a video is playing).
-   **Alt/Option + Right Arrow**: Navigate to the next video in the search results (when a video is playing).

## Important Note

**A YouTube API Key is recommended for the best experience.** Without an API key, the extension will still work but with limited search functionality (using an embedded search playlist which may have ads or different results).

To set up your API key:
1.  [Get a YouTube API key](https://developers.google.com/youtube/v3/getting-started)
2.  Open the YT-Video interface (e.g., by clicking the YouTube button or using Ctrl/Cmd + Y).
3.  Click the "Settings" button in the overlay's search bar.
4.  Enter your API key and enable "Use YouTube API Key".

## Screenshots

1.  YT-Video Settings - with API Key

    ![YT-Video Settings](screenshot-0.png)

2.  YT-Video - ways to invoke the functionality

    ![YT-Video - Invoke](screenshot-1.png)

3.  YT-Video - overlay with search result for the selected track

    ![YT-Video - Search](screenshot-2.png)

4.  YT-Video - overlay playing a chosen video with navigation buttons

    ![YT-Video - Play](screenshot-3.png)


## More

Like it? Star it!  
[![Github Stars badge](https://img.shields.io/github/stars/BojanRaic/spicetify-extensions?logo=github&style=social)](https://github.com/BojanRaic/spicetify-extensions/)

If you experience any problems, please [create a new issue](https://github.com/BojanRaic/spicetify-extensions/issues/new/choose) on the GitHub repo.  
![https://github.com/BojanRaic/spicetify-extensions/issues](https://img.shields.io/github/issues/BojanRaic/spicetify-extensions?logo=github) 
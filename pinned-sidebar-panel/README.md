# Spicetify Pinned Sidebar Panel

Spicetify extension to automatically restore a preferred right-hand sidebar panel after a configurable delay.

## Features

*   Ensures your chosen sidebar panel (e.g., "Listening Activity", "Queue", "Now Playing View", "Connect to a device") automatically reappears.
*   Activates after a temporary panel (like "Queue" or "Connect to a device" modal) is closed or if no specific panel is active for a set time.
*   Configurable: 
    *   Enable/Disable the auto-restore feature.
    *   Select your preferred panel from a dropdown.
    *   Set the timeout (in seconds) before the panel is restored.
*   Settings are accessible as direct rows in the profile dropdown menu.
*   User preferences are saved in `localStorage`.

## Usage

1.  Install the extension (e.g., via Spicetify Marketplace or manually) and ensure Spicetify is applied to Spotify.
2.  Click on your profile picture/name in the top-right corner of Spotify.
3.  Find the Pinned Sidebar Panel rows grouped above Settings.
4.  Toggle `Pinned Sidebar Panel` to enable or disable the feature.
5.  Select the preferred panel using its radio row.
6.  Select the restore delay using a seconds row.

## Screenshot

![Pinned Sidebar Panel Settings](screenshot.png)

## Notes

*   The extension monitors changes in the sidebar and main view to detect when panels are opened or closed.
*   If you manually switch to your preferred panel, the auto-restore timer for that instance is typically cleared.
*   The minimum timeout is 20 seconds to prevent overly aggressive switching.
*   This extension works independently. If using SidebarCustomizer as well, make sure that the settings of the two extensions do not contradict or overlap.

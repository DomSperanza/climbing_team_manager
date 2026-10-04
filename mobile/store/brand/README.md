# SCC Coach icon

`icon.svg` is the source of the app icon: a white open peak (in the style of Springs Climbing Center's logo) with "SCC COACH" in Anton, on black. The font is `Anton-Regular.ttf`, under the SIL Open Font License (`Anton-OFL.txt`), which allows using it in an app icon.

To change the icon:
1. Edit `icon.svg`.
2. Render it at 1024×1024, for example with headless Chrome:
   `google-chrome --headless --window-size=1024,1024 --screenshot=icon.png icon.svg`
3. Regenerate the files in `assets/images/` and `public/`:
   - `icon.png` must have no transparency, for Apple;
   - the Android layers are the white mark on transparent, scaled to 45% so they stay inside Android's round mask.

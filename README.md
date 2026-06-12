# 🎡 Spin the Wheel — Student Picker

A lightweight, browser-based classroom tool for randomly selecting students using an animated spin wheel. No installation, no server, no sign-up — just open the HTML file and go.

## Links
Website - https://spinmywheel.netlify.app/

Github - https://github.com/jdobbs34/Spin-the-Wheel


## Features


Spin the wheel — smooth animated spin that lands on a random student
Auto-removes picked students — each selected name disappears from the wheel so no one gets picked twice
Reset anytime — bring everyone back with one click
Saved class lists — create and manage multiple classes, each with their own student roster
Add students individually — type a name and press Enter
Add multiple at once — paste a list (one per line or comma-separated)
Rename or delete classes — full class management from the sidebar
Persistent storage — classes and rosters are saved to your browser's localStorage, so they survive page refreshes
3 prebuilt demo classes — loaded on first use so you can try it right away
Dark mode support — automatically follows your system preference
Responsive layout — works on desktop and mobile



## Getting Started

No installation needed.


Download spin-the-wheel.html
Open it in any modern web browser (Chrome, Firefox, Safari, Edge)
Start spinning!



How to Use

## Managing Classes

ActionHowCreate a classType a name in the sidebar input and press Enter or click +Switch classClick any class in the left sidebarRename a classClick the ✏️ pencil icon next to the class titleDelete a classHover a class in the sidebar → click the 🗑 trash icon

## Managing Students

ActionHowAdd one studentType in the name field and press Enter or click AddAdd multiple studentsClick Add multiple → paste names (one per line or comma-separated) → click Add allRemove a studentClick the × on any name tagLoad demo namesClick Demo names to populate with 10 sample students

## Running The Wheel

ActionHowSpinClick the Spin! buttonReset (restore all names)Click the Reset button


## File Structure

This project is a single self-contained file:

spin-the-wheel.html   ← everything lives here (HTML + CSS + JS)
README.md

No dependencies to install. The only external resource is the Tabler Icons webfont, loaded via CDN for the UI icons.


## Browser Compatibility

Works in all modern browsers. Requires JavaScript enabled.

BrowserSupportedChrome / Edge✅Firefox✅Safari✅Mobile browsers✅
Note: Class data is stored in localStorage. Clearing your browser data will erase saved classes. If you want to preserve your rosters, back up the names before clearing.

## Customisation

Since it's a single HTML file, everything is easy to edit:

Wheel colours — edit the COLORS array near the top of the <script> section
Prebuilt demo classes — edit the PREBUILT array to replace the default class names and student lists
Spin duration — adjust the duration variable in the spin() function (milliseconds)
Max name length — change the maxlength attribute on the name inputs


## License

MIT — free to use, modify, and share.
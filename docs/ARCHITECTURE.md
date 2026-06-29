# NutriPro Architecture

NutriPro is currently a static browser app designed for polished demos and easy migration to real backend services.

## Folder Structure

```text
.
├── index.html              # App shell
├── styles.css              # Responsive UI system
├── app.js                  # Presentation UI and client routing
├── server.js               # Small local static server
├── src/
│   ├── data/
│   │   └── mockData.js     # Realistic seed data for the demo
│   └── services/
│       ├── authService.js
│       ├── certificateService.js
│       ├── courseService.js
│       ├── lessonService.js
│       ├── mediaService.js
│       ├── notificationService.js
│       ├── programService.js
│       ├── purchaseService.js
│       ├── roleService.js
│       ├── ticketService.js
│       ├── userService.js
│       └── index.js
├── scripts/
│   ├── build.js            # Creates dist/
│   └── validate.js         # Checks required project files
└── docs/
```

## Current Runtime

The app uses hash-based routing and browser storage for demo session state. Data comes from services that read from `src/data/mockData.js`.

## Production Direction

The UI should continue calling services. Replace service internals with API requests, database queries, or server actions later without rewriting the dashboards and pages.

# Nutripro

Nutripro is a React demo for the PDF-defined Admin and Student flows only.

Current scope:
- Admin dashboard
- Users Admin
- Post Courses
- Certificates Generator
- Student dashboard
- Student certificates
- Student owned courses
- Student community
- Course detail with modules, PDFs, videos, and module progress

The project uses mock data only for now. It is structured so real database and storage integrations can be added later without changing the demo scope.

## Tech

- React 19
- Esbuild
- Simple SPA routing with browser history
- Mock in-memory state

## Project structure

```text
src/
  app/
    App.jsx
  components/
    ui.jsx
  data/
    mockData.js
  pages/
    AdminWorkspacePage.jsx
    LoginPage.jsx
    StudentWorkspacePage.jsx
  routes/
    appRoutes.js
scripts/
  build.js
  validate.js
index.html
styles.css
server.js
```

## Commands

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run validate`
- `npm run check`

### What they do

- `npm run dev`
  Builds the app and starts the local preview server on `http://127.0.0.1:4173`

- `npm run build`
  Creates a production bundle in `dist/`

- `npm run preview`
  Serves the already-built `dist/` folder

- `npm run validate`
  Runs a scope check to make sure out-of-scope features are not present in the app source

- `npm run check`
  Runs validation and then builds the production bundle

## Deployment notes

- The build output is written to `dist/`
- The included `server.js` supports SPA route fallback for direct route visits
- This project is ready to upload to GitHub as a mock-data demo

## Future integration points

TODO comments are already added in the source for:
- Users
- Courses
- Modules
- PDF uploads
- Video uploads
- Certificates
- Student progress
- Community posts

No real database is connected yet.

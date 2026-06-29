# Nutripro

Nutripro is a Vite + React demo for the PDF-defined Admin and Student flows only.

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
- Vite 5
- Simple SPA routing with browser history
- Mock in-memory state

## Project structure

```text
src/
  App.jsx
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
  validate.js
index.html
styles.css
vite.config.js
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
  Starts the Vite dev server

- `npm run build`
  Creates a production bundle in `dist/`

- `npm run preview`
  Serves the already-built `dist/` folder with Vite preview

- `npm run validate`
  Runs a scope check to make sure out-of-scope features are not present in the app source

- `npm run check`
  Runs validation and then builds the production bundle

## Deployment notes

- The build output is written to `dist/`
- Vercel should deploy the static `dist/` folder only
- `.vercelignore` keeps non-deployment files out of the Vercel upload
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

# Future Database Integration

The mock service layer is the database integration boundary.

## Suggested Tables

- users
- roles
- user_roles
- role_history
- courses
- programs
- program_courses
- modules
- lessons
- videos
- resources
- media_library
- enrollments
- program_enrollments
- lesson_progress
- video_progress
- orders
- order_items
- certificates
- certificate_audit_logs
- reviews
- notes
- question_banks
- questions
- assessment_attempts
- exam_settings
- badges
- user_badges
- prerequisites
- goals
- announcements
- wishlists
- tickets
- ticket_replies
- ticket_attachments
- internal_ticket_notes
- knowledge_base_categories
- knowledge_base_articles
- review_requests
- review_comments
- course_versions
- publishing_schedule
- audit_logs
- feature_flags
- notifications

## Upload Models

`media_library` stores the original and normalized filenames, file and MIME types, byte size, provider URL, uploader, upload timestamp, lifecycle status, and optional attachment target. `videos` stores lesson video source type, uploaded or embedded URL, thumbnail, approval data, and status. `lesson_resources` provides an ordered many-to-one lesson attachment list. `review_requests` and `review_comments` preserve submission, decision, reviewer, and feedback history.

## Storage Provider Migration

1. Keep the UI calling `storageService`; do not add provider SDK calls to `app.js`.
2. Move validation and role authorization to an authenticated backend endpoint.
3. Generate signed upload URLs and store only durable provider object keys/URLs in `media_library`.
4. Process video thumbnails, transcodes, virus scans, and document previews asynchronously.
5. Move review state transitions into database transactions and record an audit event for every decision.
6. Expose student media only when its status is `approved` or `published` and the student can access the lesson.

## Migration Plan

1. Keep `USE_MOCK_DATA=true` for demos.
2. Add a backend API or database client.
3. Replace each service method with a database-backed implementation.
4. Preserve response shapes used by `app.js`.
5. Add authentication sessions and server-side authorization checks.
6. Add integration tests around service contracts before replacing mock data.

## Service Replacement Examples

- `authService.login(email)` becomes an auth-provider lookup plus password/session verification.
- `courseService.listPublishedCourses()` becomes a query filtered by `status = published`.
- `purchaseService.createMockCoursePurchase()` becomes a payment-intent completion handler that creates orders and enrollments.
- `certificateService.verifyCertificate(number)` becomes a public read-only certificate query.
- `ticketService.createTicket()` becomes a ticket insert plus notification queue job.
- `storageService.uploadFile()` becomes a signed-upload request followed by a `media_library` insert.
- `reviewService.decide()` becomes a transactional review update, media status update, audit event, and notification job.

The UI should not import directly from `src/data/mockData.js`; it should continue using services.
